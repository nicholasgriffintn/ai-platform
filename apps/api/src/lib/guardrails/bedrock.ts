import { AwsClient } from "aws4fetch";

import { UserSettingsRepository } from "../../repositories/UserSettingsRepository";
import type {
  GuardrailResult,
  GuardrailsProvider,
  IEnv,
  IUser,
  IUserSettings,
} from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";
import { getLogger } from "../../utils/logger";

const logger = getLogger({ prefix: "BEDROCK_GUARDRAILS" });

export interface BedrockGuardrailsConfig {
  guardrailId: string;
  guardrailVersion?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  env: IEnv;
}

export class BedrockGuardrailsProvider implements GuardrailsProvider {
  private guardrailId: string;
  private guardrailVersion: string;
  private region: string;
  private bedrockRuntimeEndpoint: string;
  private env: IEnv;
  private user?: IUser;
  private defaultAccessKeyId: string;
  private defaultSecretAccessKey: string;

  constructor(config: BedrockGuardrailsConfig, user?: IUser) {
    this.guardrailId = config.guardrailId;
    this.guardrailVersion = config.guardrailVersion || "DRAFT";
    this.region = config.region || "us-east-1";
    this.bedrockRuntimeEndpoint = `https://bedrock-runtime.${this.region}.amazonaws.com`;
    this.env = config.env;
    this.user = user;
    this.defaultAccessKeyId = config.accessKeyId || "";
    this.defaultSecretAccessKey = config.secretAccessKey || "";
  }

  private parseAwsCredentials(apiKey: string): {
    accessKey: string;
    secretKey: string;
  } {
    const delimiter = "::@@::";
    const parts = apiKey.split(delimiter);

    if (parts.length !== 2) {
      throw new AssistantError(
        "Invalid AWS credentials format",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return { accessKey: parts[0], secretKey: parts[1] };
  }

  async validateContent(
    content: string,
    source: "INPUT" | "OUTPUT",
  ): Promise<GuardrailResult> {
    try {
      let accessKeyId = this.defaultAccessKeyId;
      let secretAccessKey = this.defaultSecretAccessKey;

      // Try to get user credentials if available
      if (this.user?.id && this.env.DB) {
        try {
          const userSettingsRepo = new UserSettingsRepository(this.env);
          const userApiKey = await userSettingsRepo.getProviderApiKey(
            this.user.id,
            "bedrock",
          );

          if (userApiKey) {
            const credentials = this.parseAwsCredentials(userApiKey);
            accessKeyId = credentials.accessKey;
            secretAccessKey = credentials.secretKey;
          }
        } catch (error) {
          logger.warn("Failed to get user API key for bedrock:", { error });
        }
      }

      if (!accessKeyId || !secretAccessKey) {
        throw new AssistantError(
          "No valid credentials found for Bedrock Guardrails",
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      const aws = new AwsClient({
        accessKeyId,
        secretAccessKey,
        region: this.region,
        service: "bedrock",
      });

      const url = `${this.bedrockRuntimeEndpoint}/guardrail/${this.guardrailId}/version/${this.guardrailVersion}/apply`;

      const body = JSON.stringify({
        source,
        content: [
          {
            text: {
              text: content,
            },
          },
        ],
      });

      const response = await aws.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error(
          "Bedrock Guardrails API Error:",
          response.status,
          response.statusText,
          errorBody,
        );
        throw new AssistantError(
          `Bedrock Guardrails API error (${response.status}): ${errorBody || response.statusText}`,
          ErrorType.PROVIDER_ERROR,
          response.status,
        );
      }

      const data = (await response.json()) as Record<string, any>;
      const violations: string[] = [];

      if (data.assessments?.[0]) {
        const assessment = data.assessments[0];

        if (assessment.topicPolicy?.topics) {
          violations.push(
            ...assessment.topicPolicy.topics
              .filter((topic: { action: string }) => topic.action === "BLOCKED")
              .map((topic: { name: string }) => `Blocked topic: ${topic.name}`),
          );
        }

        if (assessment.contentPolicy?.filters) {
          violations.push(
            ...assessment.contentPolicy.filters
              .filter(
                (filter: { action: string }) => filter.action === "BLOCKED",
              )
              .map(
                (filter: { type: string }) =>
                  `Content violation: ${filter.type}`,
              ),
          );
        }

        if (assessment.sensitiveInformationPolicy?.piiEntities) {
          violations.push(
            ...assessment.sensitiveInformationPolicy.piiEntities
              .filter(
                (entity: { action: string }) => entity.action === "BLOCKED",
              )
              .map(
                (entity: { type: string }) => `PII detected: ${entity.type}`,
              ),
          );
        }
      }

      return {
        isValid: data.action === "NONE",
        violations,
        rawResponse: data,
      };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }
      logger.error("Error validating content with Bedrock Guardrails:", {
        error,
      });
      throw new AssistantError(
        `Failed to validate content with Bedrock Guardrails: ${error instanceof Error ? error.message : String(error)}`,
        ErrorType.PROVIDER_ERROR,
      );
    }
  }
}
