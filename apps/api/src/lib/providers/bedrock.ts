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

const logger = getLogger({ prefix: "lib/providers/bedrock" });

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
    storageService?: StorageService,
    _assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const modelConfig = await getModelConfigByMatchingModel(params.model || "");
    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${params.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
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
        messages: await this.formatBedrockMessages(params, storageService),
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
      messages: await this.formatBedrockMessages(params, storageService),
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
    storageService?: StorageService,
  ): Promise<any[]> {
    const bucketOwner = params.env.EMBEDDINGS_OUTPUT_BUCKET_OWNER;

    const mappedMessages = await Promise.all(
      params.messages.map((message) =>
        this.mapMessageToBedrock(message, bucketOwner, storageService),
      ),
    );

    return mappedMessages.filter(
      (message): message is Record<string, any> => Boolean(message),
    );
  }

  private async mapMessageToBedrock(
    message: Message,
    bucketOwner?: string,
    storageService?: StorageService,
  ): Promise<Record<string, any> | null> {
    if (!message) {
      return null;
    }

    if (message.role === "tool") {
      return await this.mapToolResultMessage(message, bucketOwner, storageService);
    }

    const role = message.role === "developer" ? "system" : message.role;
    const content = await this.mapContentToBedrock(
      message.content,
      bucketOwner,
      storageService,
    );

    if (content.length === 0 && !message.tool_calls?.length) {
      return null;
    }

    const bedrockMessage: Record<string, any> = {
      role,
      content,
    };

    if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
      const toolUseBlocks = message.tool_calls
        .map((toolCall, index) => {
          const toolUseId =
            toolCall.id ||
            toolCall.tool_use_id ||
            toolCall.toolUseId ||
            `tool-${index + 1}`;
          const name = toolCall.function?.name || toolCall.name;
          if (!name) {
            return null;
          }

          let input = toolCall.function?.arguments ?? toolCall.arguments ?? {};
          if (typeof input === "string") {
            try {
              input = JSON.parse(input);
            } catch {
              // If parsing fails, keep the original string payload
            }
          }

          return {
            toolUse: {
              toolUseId,
              name,
              input,
            },
          };
        })
        .filter((block): block is Record<string, any> => Boolean(block));

      if (toolUseBlocks.length > 0) {
        bedrockMessage.content = [...content, ...toolUseBlocks];
      }
    }

    return bedrockMessage;
  }

  private async mapToolResultMessage(
    message: Message,
    bucketOwner?: string,
    storageService?: StorageService,
  ): Promise<Record<string, any> | null> {
    const toolUseId = message.tool_call_id || message.id;
    if (!toolUseId) {
      return null;
    }

    const status = message.status === "error" ? "error" : "success";
    const contentBlocks = await this.mapContentToBedrock(
      message.content,
      bucketOwner,
      storageService,
    );

    return {
      role: "user",
      content: [
        {
          toolResult: {
            toolUseId,
            status,
            content: contentBlocks.length > 0 ? contentBlocks : undefined,
          },
        },
      ],
    };
  }

  private async mapContentToBedrock(
    content: Message["content"],
    bucketOwner?: string,
    storageService?: StorageService,
  ): Promise<any[]> {
    if (typeof content === "string") {
      return content ? [{ text: { text: content } }] : [];
    }

    if (!Array.isArray(content)) {
      return [];
    }

    const mappedItems = await Promise.all(
      content.map((item) =>
        this.mapContentItemToBedrock(item, bucketOwner, storageService),
      ),
    );

    return mappedItems.filter(
      (item): item is Record<string, any> => Boolean(item),
    );
  }

  private async mapContentItemToBedrock(
    item: MessageContent | string,
    bucketOwner?: string,
    storageService?: StorageService,
  ): Promise<Record<string, any> | null> {
    if (!item) {
      return null;
    }

    if (typeof item === "string") {
      return { text: { text: item } };
    }

    if ("text" in item && typeof item.text === "string") {
      return { text: { text: item.text } };
    }

    if (item.type === "image_url" && item.image_url?.url) {
      const { source, format } = await this.resolveMediaSource(
        item.image_url.url,
        bucketOwner,
        storageService,
      );
      if (!source) {
        return null;
      }
      return {
        image: {
          format,
          source,
        },
      };
    }

    if (item.type === "video_url" && item.video_url?.url) {
      const { source, format } = await this.resolveMediaSource(
        item.video_url.url,
        bucketOwner,
        storageService,
      );
      if (!source) {
        return null;
      }
      return {
        video: {
          format,
          source,
        },
      };
    }

    if (item.type === "audio_url" && item.audio_url?.url) {
      const { source, format } = await this.resolveMediaSource(
        item.audio_url.url,
        bucketOwner,
        storageService,
      );
      if (!source) {
        return null;
      }
      return {
        audio: {
          format,
          source,
        },
      };
    }

    if (item.type === "input_audio" && item.input_audio?.data) {
      const format = item.input_audio.format || "wav";
      return {
        audio: {
          format,
          source: { bytes: item.input_audio.data },
        },
      };
    }

    if (item.type === "document_url" && item.document_url?.url) {
      const { source, format } = await this.resolveMediaSource(
        item.document_url.url,
        bucketOwner,
        storageService,
      );
      if (!source) {
        return null;
      }
      return {
        document: {
          format,
          source,
        },
      };
    }

    if (
      item.type === "markdown_document" &&
      item.markdown_document?.markdown
    ) {
      const markdown = item.markdown_document.markdown;
      const base64 = Buffer.from(markdown, "utf-8").toString("base64");
      return {
        document: {
          format: "markdown",
          source: { bytes: base64 },
        },
      };
    }

    return null;
  }

  private async resolveMediaSource(
    url: string,
    bucketOwner?: string,
    storageService?: StorageService,
  ): Promise<{ source: Record<string, any> | null; format: string }> {
    if (!url) {
      return { source: null, format: "" };
    }

    if (url.startsWith("data:")) {
      const base64Match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) {
        return { source: null, format: "" };
      }

      const mimeType = base64Match[1];
      const data = base64Match[2];
      return {
        source: { bytes: data },
        format: this.inferFormatFromMimeType(mimeType),
      };
    }

    if (url.startsWith("s3://")) {
      const source: Record<string, any> = {
        s3Location: {
          uri: url,
        },
      };

      if (bucketOwner) {
        source.s3Location.bucketOwner = bucketOwner;
      }

      return {
        source,
        format: this.inferFormatFromExtension(url),
      };
    }

    const downloaded = await this.downloadExternalMedia(url, storageService);
    if (!downloaded) {
      return {
        source: null,
        format: this.inferFormatFromExtension(url),
      };
    }

    return {
      source: { bytes: downloaded.data },
      format: this.inferFormatFromMimeType(downloaded.mimeType),
    };
  }

  private async downloadExternalMedia(
    url: string,
    _storageService?: StorageService,
  ): Promise<{ data: string; mimeType: string } | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = response.headers.get("content-type") ||
        this.inferMimeTypeFromExtension(url) ||
        "application/octet-stream";

      return { data: base64Data, mimeType };
    } catch {
      return null;
    }
  }

  private inferMimeTypeFromExtension(url: string): string | null {
    const extensionMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (!extensionMatch) {
      return null;
    }

    const extension = extensionMatch[1].toLowerCase();
    switch (extension) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "gif":
        return "image/gif";
      case "webp":
        return "image/webp";
      case "mp4":
        return "video/mp4";
      case "mov":
        return "video/quicktime";
      case "avi":
        return "video/x-msvideo";
      case "mkv":
        return "video/x-matroska";
      case "mp3":
        return "audio/mpeg";
      case "wav":
        return "audio/wav";
      case "pdf":
        return "application/pdf";
      default:
        return null;
    }
  }

  private inferFormatFromMimeType(mimeType: string): string {
    const [type, subtype] = mimeType.split("/");
    if (!subtype) {
      return mimeType;
    }

    if (type === "image" || type === "audio" || type === "video") {
      return subtype;
    }

    return mimeType;
  }

  private inferFormatFromExtension(url: string): string {
    const extensionMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (!extensionMatch) {
      return "";
    }

    const extension = extensionMatch[1].toLowerCase();
    switch (extension) {
      case "jpg":
        return "jpeg";
      case "tif":
        return "tiff";
      default:
        return extension;
    }
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
          messages: await this.formatBedrockMessages(params),
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
