import { AwsClient } from "aws4fetch";

import { gatewayId } from "~/constants/app";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { createEventStreamParser } from "~/utils/awsEventStream";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
  createCommonParameters,
  getToolsForProvider,
} from "~/utils/parameters";
import { BaseProvider } from "./base";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";

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

  protected async getEndpoint(
    params: ChatCompletionParameters,
  ): Promise<string> {
    const region = "us-east-1";
    const modelConfig = await getModelConfigByMatchingModel(params.model || "");

    if (modelConfig?.bedrockApiOperation) {
      if (params.stream && modelConfig?.bedrockStreamingApiOperation) {
        return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/${modelConfig.bedrockStreamingApiOperation}`;
      }
      return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/${modelConfig.bedrockApiOperation}`;
    }

    if (params.stream) {
      return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/converse-stream`;
    }
    return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/converse`;
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    return {
      "Content-Type": "application/json",
    };
  }

  async getMediaSourceFromMessages(
    params: ChatCompletionParameters,
  ): Promise<Record<string, any>> {
    if (!params.env.EMBEDDINGS_OUTPUT_BUCKET_OWNER) {
      throw new AssistantError(
        "Missing EMBEDDINGS_OUTPUT_BUCKET_OWNER",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const lastMessage = params.messages[params.messages.length - 1];

    if (!Array.isArray(lastMessage.content)) {
      throw new AssistantError(
        "Last message content must be an array",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const videoContent = lastMessage.content.find(
      (item: any) => item.type === "video_url",
    );

    if (!videoContent?.video_url?.url) {
      throw new AssistantError(
        "Video URL not found in last message content",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    if (videoContent.video_url.url.startsWith("s3://")) {
      return {
        s3Location: {
          uri: videoContent.video_url.url,
          bucketOwner: params.env.EMBEDDINGS_OUTPUT_BUCKET_OWNER,
        },
      };
    } else if (videoContent.video_url.url.startsWith("data:")) {
      const base64Data = videoContent.video_url.url.replace(
        /^data:.*?;base64,/,
        "",
      );
      return {
        base64String: base64Data,
      };
    }

    throw new AssistantError(
      "Could not get media source from messages",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  async getInputPromptFromMessages(
    params: ChatCompletionParameters,
  ): Promise<string> {
    const lastMessage = params.messages[params.messages.length - 1];
    return typeof lastMessage.content === "string"
      ? lastMessage.content
      : Array.isArray(lastMessage.content)
        ? (lastMessage.content[0] as any)?.text || ""
        : "";
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

    const isTwelveLabsEmbed = params.model?.includes(
      "twelvelabs.marengo-embed",
    );

    if (isTwelveLabsEmbed) {
      const mediaSource = await this.getMediaSourceFromMessages(params);

      return {
        modelId: params.model,
        modelInput: {
          inputType: "video",
          mediaSource,
        },
        outputDataConfig: {
          s3OutputDataConfig: {
            s3Uri: `s3://${params.env.EMBEDDINGS_OUTPUT_BUCKET || "polychat-embeddings"}/${params.model}/${params.completion_id || Date.now()}`,
          },
        },
      };
    }

    const isTwelveLabsPegasus = params.model?.includes("twelvelabs.pegasus");

    if (isTwelveLabsPegasus) {
      const inputPrompt = await this.getInputPromptFromMessages(params);
      const mediaSource = await this.getMediaSourceFromMessages(params);

      const requestBody: Record<string, any> = {
        inputPrompt,
        mediaSource,
      };

      if (params.temperature !== undefined) {
        requestBody.temperature = params.temperature;
      }

      if (params.max_tokens !== undefined) {
        requestBody.maxOutputTokens = params.max_tokens;
      }

      return requestBody;
    }

    const type = modelConfig?.type || ["text"];
    const isImageType =
      type.includes("text-to-image") || type.includes("image-to-image");
    const isVideoType =
      type.includes("text-to-video") || type.includes("image-to-video");

    if (isVideoType) {
      return {
        messages: this.formatBedrockMessages(params),
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

    return {
      ...(params.system_prompt && {
        system: [{ text: params.system_prompt }],
      }),
      messages: this.formatBedrockMessages(params),
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
  private formatBedrockMessages(params: ChatCompletionParameters): any[] {
    return params.messages.map((message) => ({
      role: message.role,
      content: [
        {
          type: "text",
          text: message.content,
        },
      ],
    }));
  }

  private async getAwsCredentials(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<{ accessKey: string; secretKey: string }> {
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

    if (!accessKey || !secretKey) {
      throw new AssistantError(
        "Missing AWS credentials",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return { accessKey, secretKey };
  }

  private async makeBedrockRequest(
    endpoint: string,
    body: Record<string, any>,
    params: ChatCompletionParameters,
    operation: string,
    userId?: number,
  ): Promise<Response> {
    const { accessKey, secretKey } = await this.getAwsCredentials(
      params,
      userId,
    );
    const region = "us-east-1";

    const awsClient = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      region,
      service: "bedrock",
    });

    const headers = await this.getHeaders(params);

    const presignedRequest = await awsClient.sign(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!presignedRequest.url) {
      throw new AssistantError("Failed to get presigned request from Bedrock");
    }

    const signedUrl = new URL(presignedRequest.url);
    signedUrl.host = "gateway.ai.cloudflare.com";
    signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/${operation}`;

    const response = await fetch(signedUrl, {
      method: "POST",
      headers: presignedRequest.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Failed to ${operation} from Bedrock`, {
        error: errorText,
      });
      throw new AssistantError(`Failed to ${operation} from Bedrock`);
    }

    return response;
  }

  async countTokens(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<{ inputTokens: number }> {
    this.validateParams(params);

    const region = "us-east-1";
    const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/count-tokens`;
    const body = {
      input: {
        converse: {
          ...(params.system_prompt && {
            system: [{ text: params.system_prompt }],
          }),
          messages: this.formatBedrockMessages(params),
        },
      },
    };

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        const response = await this.makeBedrockRequest(
          endpoint,
          body,
          params,
          "count-tokens",
          userId,
        );
        const data = (await response.json()) as { inputTokens: number };
        return { inputTokens: data.inputTokens };
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

  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    this.validateParams(params);

    const bedrockUrl = await this.getEndpoint(params);
    const body = await this.mapParameters(params);

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        const { accessKey, secretKey } = await this.getAwsCredentials(
          params,
          userId,
        );
        const region = "us-east-1";

        const awsClient = new AwsClient({
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
          region,
          service: "bedrock",
        });

        const headers = await this.getHeaders(params);

        const presignedRequest = await awsClient.sign(bedrockUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!presignedRequest.url) {
          throw new AssistantError(
            "Failed to get presigned request from Bedrock",
          );
        }

        const signedUrl = new URL(presignedRequest.url);
        signedUrl.host = "gateway.ai.cloudflare.com";

        let operationPath = "converse";
        if (params.model?.includes("twelvelabs.marengo-embed")) {
          operationPath = "start-async-invoke";
        } else if (params.model?.includes("twelvelabs.pegasus")) {
          operationPath = params.stream
            ? "invoke-with-response-stream"
            : "invoke";
        } else if (params.stream) {
          operationPath = "converse-stream";
        }

        signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/${operationPath}`;

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
