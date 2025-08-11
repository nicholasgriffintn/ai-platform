import { AwsClient } from "aws4fetch";

import { gatewayId } from "~/constants/app";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters, Message, MessageContent } from "~/types";
import { createEventStreamParser } from "~/utils/awsEventStream";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
  createCommonParameters,
  getToolsForProvider,
} from "~/utils/parameters";
import { BaseProvider } from "./base";
import {
  fetchImageAsBase64,
  getImageFormat,
  validateImageFormat,
} from "~/lib/utils/imageProcessor";

const logger = getLogger({ prefix: "BEDROCK" });

export class BedrockProvider extends BaseProvider {
  name = "bedrock";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "bedrock";
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

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (!params.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  protected getEndpoint(params: ChatCompletionParameters): string {
    const region = "us-east-1";
    if (params.stream) {
      return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/converse-stream`;
    }
    return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/converse`;
  }

  protected getHeaders(): Record<string, string> {
    return {};
  }

  private messageHasImageContent(message: Message): boolean {
    if (typeof message.content === "string") return false;
    return message.content.some((c) => c.type === "image_url");
  }

  private anyMessageHasImageContent(messages: Message[] = []): boolean {
    return messages.some((m) => this.messageHasImageContent(m));
  }

  async mapParameters(
    params: ChatCompletionParameters,
    _storageService?: StorageService,
    _assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const modelConfig = await getModelConfigByMatchingModel(params.model || "");
    if (!modelConfig) {
      throw new Error(`Model configuration not found for ${params.model}`);
    }

    const type = modelConfig?.type || ["text"];
    const isImageType =
      type.includes("text-to-image") || type.includes("image-to-image");
    const isVideoType =
      type.includes("text-to-video") || type.includes("image-to-video");

    if (isVideoType) {
      return {
        messages: await this.formatBedrockMessages(params),
        taskType: "TEXT_VIDEO",
        textToVideoParams: {
          text:
            typeof params.messages[params.messages.length - 1].content ===
            "string"
              ? params.messages[params.messages.length - 1].content
              : Array.isArray(
                  params.messages[params.messages.length - 1].content,
                )
                ? (
                    params.messages[params.messages.length - 1]
                      .content[0] as any
                  )?.text || ""
                : "",
        },
        videoGenerationConfig: {
          durationSeconds: 6,
          fps: 24,
          dimension: "1280x720",
        },
      };
    }

    if (isImageType) {
      return {
        textToImageParams: {
          text:
            typeof params.messages[params.messages.length - 1].content ===
            "string"
              ? params.messages[params.messages.length - 1].content
              : Array.isArray(
                  params.messages[params.messages.length - 1].content,
                )
                ? (
                    params.messages[params.messages.length - 1]
                      .content[0] as any
                  )?.text || ""
                : "",
        },
        taskType: "TEXT_IMAGE",
        imageGenerationConfig: {
          quality: "standard",
          width: 1280,
          height: 1280,
          numberOfImages: 1,
        },
      };
    }

    const commonParams = createCommonParameters(
      params,
      modelConfig,
      this.name,
      this.isOpenAiCompatible,
    );

    const toolsParams = getToolsForProvider(params, modelConfig, this.name);
    const supportsToolCalls = modelConfig?.supportsToolCalls || false;

    const toolConfig = supportsToolCalls
      ? { toolConfig: { tools: toolsParams.tools } }
      : {};

    const hasImageBlocks = this.anyMessageHasImageContent(params.messages || []);
    if (hasImageBlocks) {
      if (!modelConfig.multimodal || !modelConfig.type.includes("image-to-text")) {
        throw new AssistantError(
          "Selected model does not support image inputs",
          ErrorType.PARAMS_ERROR,
        );
      }
    }

    return {
      ...(params.system_prompt && {
        system: [{ text: params.system_prompt }],
      }),
      messages: await this.formatBedrockMessages(params),
      inferenceConfig: {
        temperature: commonParams.temperature,
        maxTokens: commonParams.max_tokens,
        topP: commonParams.top_p,
      },
      ...toolConfig,
    };
  }

  /**
   * Format messages for Bedrock models
   * @param params - The chat completion parameters
   * @returns The formatted messages
   */
  private async formatBedrockMessages(
    params: ChatCompletionParameters,
  ): Promise<any[]> {
    const formatted = [] as any[];

    for (const message of params.messages || []) {
      const role = message.role;

      if (typeof message.content === "string") {
        formatted.push({
          role,
          content: [
            {
              type: "text",
              text: message.content,
            },
          ],
        });
        continue;
      }

      const contentBlocks: MessageContent[] = message.content as MessageContent[];
      const parts: any[] = [];

      for (const block of contentBlocks) {
        if (block.type === "text" && typeof block.text === "string") {
          parts.push({ type: "text", text: block.text });
          continue;
        }

        if (block.type === "image_url" && block.image_url?.url) {
          const imageUrl = block.image_url.url;

          if (!validateImageFormat(imageUrl)) {
            throw new AssistantError(
              "Image format not supported by Amazon Nova (supported: JPEG, PNG, GIF, WEBP)",
              ErrorType.PARAMS_ERROR,
            );
          }

          const base64 = await fetchImageAsBase64(imageUrl);
          const format = getImageFormat(imageUrl) || "png";

          parts.push({
            image: {
              format,
              source: { bytes: base64 },
            },
          });
          continue;
        }
      }

      if (parts.length === 0) {
        // Fallback to empty text to avoid provider errors
        parts.push({ type: "text", text: "" });
      }

      formatted.push({ role, content: parts });
    }

    return formatted;
  }

  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    this.validateParams(params);

    const bedrockUrl = this.getEndpoint(params);
    const body = await this.mapParameters(params);

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        let accessKey = params.env.BEDROCK_AWS_ACCESS_KEY || "";
        let secretKey = params.env.BEDROCK_AWS_SECRET_KEY || "";

        if (userId) {
          try {
            const userApiKey = await this.getApiKey(params, userId);
            if (userApiKey) {
              const credentials = this.parseAwsCredentials(userApiKey);
              if (credentials.accessKey) {
                accessKey = credentials.accessKey;
              }
              if (credentials.secretKey) {
                secretKey = credentials.secretKey;
              }
            }
          } catch (error) {
            logger.warn(
              "Failed to get user AWS credentials, using environment variables:",
              { error },
            );
          }
        }

        const region = "us-east-1";

        const awsClient = new AwsClient({
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
          region,
          service: "bedrock",
        });

        const presignedRequest = await awsClient.sign(bedrockUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!presignedRequest.url) {
          throw new AssistantError(
            "Failed to get presigned request from Bedrock",
          );
        }

        const signedUrl = new URL(presignedRequest.url);
        signedUrl.host = "gateway.ai.cloudflare.com";

        if (params.stream) {
          signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/converse-stream`;
        } else {
          signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/converse`;
        }

        const response = await fetch(signedUrl, {
          method: "POST",
          headers: presignedRequest.headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new AssistantError("Failed to get response from Bedrock");
        }

        const isStreaming = params.stream;

        if (isStreaming) {
          const eventStreamParser = createEventStreamParser();
          return response.body.pipeThrough(eventStreamParser);
        }

        let data: Record<string, any>;
        try {
          data = (await response.json()) as Record<string, any>;
        } catch (jsonError) {
          const responseText = await response.text();
          logger.error(`Failed to parse JSON response from ${this.name}`, {
            error: jsonError,
            responseText: responseText.substring(0, 200),
          });
          throw new AssistantError(
            `${this.name} returned invalid JSON response: ${jsonError instanceof Error ? jsonError.message : "Unknown JSON parse error"}`,
            ErrorType.PROVIDER_ERROR,
          );
        }

        const eventId = response.headers.get("cf-aig-event-id");
        const log_id = response.headers.get("cf-aig-log-id");
        const cacheStatus = response.headers.get("cf-aig-cache-status");

        return this.formatResponse(
          { ...data, eventId, log_id, cacheStatus },
          params,
        );
      },
      analyticsEngine: params.env?.ANALYTICS,
      settings: {
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        top_p: params.top_p,
        top_k: params.top_k,
        seed: params.seed,
        repetition_penalty: params.repetition_penalty,
        frequency_penalty: params.frequency_penalty,
        presence_penalty: params.presence_penalty,
      },
      userId,
      completion_id: params.completion_id,
    });
  }
}
