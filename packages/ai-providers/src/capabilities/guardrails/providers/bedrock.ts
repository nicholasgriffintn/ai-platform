import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { AwsClient } from "aws4fetch";

import type { ProviderEnv, ProviderUser } from "../../../env.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type {
  GuardrailInput,
  GuardrailResult,
  GuardrailsProvider,
  GuardrailSource,
} from "../../../types/index.js";
import { formatProviderError } from "../../../utils/errors.js";
import { parseAwsCredentials } from "../../../utils/helpers.js";
import { normaliseGuardrailInput } from "../content.js";

const logger = getLogger({ prefix: "lib/guardrails/bedrock" });

export interface BedrockGuardrailsConfig {
  guardrailId: string;
  guardrailVersion?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  env: ProviderEnv;
}

export class BedrockGuardrailsProvider implements GuardrailsProvider {
  private guardrailId: string;
  private guardrailVersion: string;
  private region: string;
  private bedrockRuntimeEndpoint: string;
  private env: ProviderEnv;
  private user?: ProviderUser;
  private defaultAccessKeyId: string;
  private defaultSecretAccessKey: string;

  constructor(
    config: BedrockGuardrailsConfig,
    user: ProviderUser | undefined,
    private readonly runtime: ProviderRuntime,
  ) {
    this.guardrailId = config.guardrailId;
    this.guardrailVersion = config.guardrailVersion || "DRAFT";
    this.region = config.region || "us-east-1";
    this.bedrockRuntimeEndpoint = `https://bedrock-runtime.${this.region}.amazonaws.com`;
    this.env = config.env;
    this.user = user;
    this.defaultAccessKeyId = config.accessKeyId || "";
    this.defaultSecretAccessKey = config.secretAccessKey || "";
  }

  async validateContent(input: GuardrailInput, source: GuardrailSource): Promise<GuardrailResult> {
    try {
      logger.debug("Validating content with Bedrock Guardrails");
      const content = normaliseGuardrailInput(input).text;
      let accessKeyId = this.defaultAccessKeyId;
      let secretAccessKey = this.defaultSecretAccessKey;

      const keyStore = this.user?.id ? this.runtime.host.keyStore(this.env) : undefined;

      if (this.user?.id && keyStore) {
        try {
          const userApiKey = await keyStore.getProviderApiKey(this.user.id, "bedrock");

          if (userApiKey) {
            const credentials = parseAwsCredentials(userApiKey);

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
        throw new AssistantError(
          await formatProviderError(response, "Bedrock Guardrails API error"),
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
              .filter((filter: { action: string }) => filter.action === "BLOCKED")
              .map((filter: { type: string }) => `Content violation: ${filter.type}`),
          );
        }

        if (assessment.sensitiveInformationPolicy?.piiEntities) {
          violations.push(
            ...assessment.sensitiveInformationPolicy.piiEntities
              .filter((entity: { action: string }) => entity.action === "BLOCKED")
              .map((entity: { type: string }) => `PII detected: ${entity.type}`),
          );
        }
      }

      logger.debug("Bedrock Guardrails validation result", {
        violations,
        data,
      });

      return {
        provider: "bedrock",
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
      throw AssistantError.fromError(
        error instanceof Error ? error : new Error("Bedrock Guardrails validation failed"),
        ErrorType.PROVIDER_ERROR,
      );
    }
  }
}
