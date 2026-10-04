import { parseAwsCredentials } from "@ngriffin_uk/polychat-ai-providers";
import { dynamoDbVectorConfigurationSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { AwsClient } from "aws4fetch";
import type z from "zod/v4";

import { readDynamoDbErrorCode, validateDynamoDbVectorIndex } from "./dynamodb";
import { getEmbeddingCredentialFingerprint } from "./scope";

export type DynamoDbVectorConfiguration = z.infer<typeof dynamoDbVectorConfigurationSchema>;

export interface DynamoDbVectorCredentials {
  getCredentials: () => Promise<string | null>;
  scopeSecret?: string;
  expectedCredentialFingerprint?: string;
}

export class DynamoDbVectorClient {
  readonly configuration: DynamoDbVectorConfiguration;
  private indexValidation?: Promise<void>;

  constructor(
    configuration: DynamoDbVectorConfiguration,
    private credentials: DynamoDbVectorCredentials,
  ) {
    const parsed = dynamoDbVectorConfigurationSchema.safeParse(configuration);

    if (!parsed.success) {
      throw new AssistantError(
        "DynamoDB Vectors requires valid configuration and a user with stored credentials",
        ErrorType.CONFIGURATION_ERROR,
        503,
      );
    }

    this.configuration = parsed.data;
  }

  private async getAwsClient(): Promise<AwsClient> {
    let apiKey: string | null;

    try {
      apiKey = await this.credentials.getCredentials();
    } catch {
      throw new AssistantError(
        "DynamoDB Vectors credentials are unavailable",
        ErrorType.CONFIGURATION_ERROR,
        503,
      );
    }

    if (!apiKey) {
      throw new AssistantError(
        "DynamoDB Vectors credentials are not configured",
        ErrorType.CONFIGURATION_ERROR,
        503,
      );
    }

    const credentials = parseAwsCredentials(apiKey);

    if (
      this.credentials.expectedCredentialFingerprint &&
      (await getEmbeddingCredentialFingerprint(this.credentials.scopeSecret, apiKey)) !==
        this.credentials.expectedCredentialFingerprint
    ) {
      throw new AssistantError(
        "DynamoDB Vectors credentials changed after the target was recorded",
        ErrorType.CONFIGURATION_ERROR,
        503,
      );
    }

    return new AwsClient({
      accessKeyId: credentials.accessKey,
      secretAccessKey: credentials.secretKey,
      region: this.configuration.region,
      service: "dynamodb",
      retries: 0,
    });
  }

  async request(
    operation: "DescribeTable" | "PutItem" | "BatchWriteItem" | "SearchVectors",
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const { region, tableName } = this.configuration;
    const suffix = region.startsWith("cn-") ? "amazonaws.com.cn" : "amazonaws.com";
    const endpoint =
      operation === "SearchVectors"
        ? `https://search-dynamodb.${region}.api.${region.startsWith("cn-") ? "amazonwebservices.com.cn" : "aws"}`
        : `https://dynamodb.${region}.${suffix}`;
    const aws = await this.getAwsClient();
    let response: Response;

    try {
      response = await aws.fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.0",
          "X-Amz-Target": `DynamoDB_20120810.${operation}`,
        },
        body: JSON.stringify(
          operation === "BatchWriteItem" ? body : { ...body, TableName: tableName },
        ),
      });
    } catch {
      throw new AssistantError("DynamoDB Vectors request failed", ErrorType.PROVIDER_ERROR, 502);
    }

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const code = readDynamoDbErrorCode(data);

      throw new AssistantError(
        code === "ConditionalCheckFailedException"
          ? "DynamoDB vector write conflicts with another scope"
          : "DynamoDB Vectors request failed",
        ErrorType.PROVIDER_ERROR,
        response.status,
      );
    }

    if (data === null) {
      throw new AssistantError("Invalid DynamoDB Vectors response", ErrorType.PROVIDER_ERROR, 502);
    }

    return data;
  }

  async ensureIndex(): Promise<void> {
    this.indexValidation ??= this.request("DescribeTable", {}).then((data) =>
      validateDynamoDbVectorIndex(data, this.configuration.indexName),
    );
    await this.indexValidation;
  }
}
