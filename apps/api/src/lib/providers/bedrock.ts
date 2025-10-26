import { AwsClient } from "aws4fetch";

import { gatewayId } from "~/constants/app";
import {
  createAsyncInvocationMetadata,
  type AsyncInvocationMetadata,
} from "~/lib/async/asyncInvocation";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters, ModelConfigItem } from "~/types";
import { createEventStreamParser } from "~/utils/awsEventStream";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
  createCommonParameters,
  getToolsForProvider,
} from "~/utils/parameters";
import { BaseProvider } from "./base";
import { formatBedrockMessages } from "./utils/bedrockContent";

const logger = getLogger({ prefix: "lib/providers/bedrock" });

type AsyncOperationStatus =
  | "IN_PROGRESS"
  | "SUCCESS"
  | "SUCCEEDED"
  | "COMPLETED"
  | "FAILED"
  | "ERROR"
  | "CANCELLED"
  | "TIMED_OUT";

export class BedrockProvider extends BaseProvider {
  name = "bedrock";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "bedrock";
  }

  private getRegion(): string {
    return "us-east-1";
  }

  private getEmbeddingsBucket(params): string {
    return params.env.EMBEDDINGS_OUTPUT_BUCKET || "polychat-embeddings";
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
    const region = this.getRegion();
    const modelConfig = await getModelConfigByMatchingModel(params.model || "");
    const operationPath = this.resolveOperationPath(params, modelConfig);

    const { awsUrl } = this.buildOperationPaths(params, operationPath, region);
    return awsUrl;
  }

  private resolveOperationPath(
    params: ChatCompletionParameters,
    modelConfig?: ModelConfigItem,
  ): string {
    const streamingOperation = modelConfig?.bedrockStreamingApiOperation;
    const defaultOperation = modelConfig?.bedrockApiOperation;

    if (params.stream) {
      if (streamingOperation) {
        return streamingOperation;
      }

      if (defaultOperation) {
        return defaultOperation;
      }

      return "converse-stream";
    }

    if (defaultOperation) {
      return defaultOperation;
    }

    return "converse";
  }

  private isAsyncOperation(operationPath: string): boolean {
    return operationPath === "async-invoke";
  }

  private buildOperationPaths(
    params: ChatCompletionParameters,
    operationPath: string,
    region: string,
  ): { awsUrl: string; cloudflarePath: string } {
    if (this.isAsyncOperation(operationPath)) {
      return {
        awsUrl: `https://bedrock-runtime.${region}.amazonaws.com/async-invoke`,
        cloudflarePath: "async-invoke",
      };
    }

    return {
      awsUrl: `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/${operationPath}`,
      cloudflarePath: `model/${params.model}/${operationPath}`,
    };
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    return {
      "Content-Type": "application/json",
    };
  }

  private async fetchAsyncInvokeStatus(
    awsClient: AwsClient,
    invocationArn: string,
    params: ChatCompletionParameters,
    region: string,
    baseHeaders: Record<string, string>,
  ): Promise<{
    data: Record<string, any>;
    status: AsyncOperationStatus | string | undefined;
  }> {
    const encodedArn = encodeURIComponent(invocationArn);
    const pollAwsUrl = `https://bedrock-runtime.${region}.amazonaws.com/async-invoke/${encodedArn}`;

    const pollHeaders = { ...baseHeaders };
    delete pollHeaders["Content-Type"];

    const pollRequest = await awsClient.sign(pollAwsUrl, {
      method: "GET",
      headers: pollHeaders,
    });

    if (!pollRequest.url) {
      throw new AssistantError(
        "Failed to get presigned async poll request from Bedrock",
        ErrorType.PROVIDER_ERROR,
      );
    }

    const signedUrl = new URL(pollRequest.url);
    signedUrl.host = "gateway.ai.cloudflare.com";
    signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/async-invoke/${encodedArn}`;

    const pollResponse = await fetch(signedUrl, {
      method: "GET",
      headers: pollRequest.headers,
    });

    if (!pollResponse.ok) {
      const errorText = await pollResponse.text();
      logger.error("Failed to poll async invocation from Bedrock", {
        error: errorText.substring(0, 200),
        invocationArn,
      });
      throw new AssistantError(
        "Failed to poll async invocation from Bedrock",
        ErrorType.PROVIDER_ERROR,
      );
    }

    let pollData: Record<string, any>;
    try {
      pollData = (await pollResponse.json()) as Record<string, any>;
    } catch (jsonError) {
      const responseText = await pollResponse.text();
      logger.error("Failed to parse async poll response from Bedrock", {
        error: jsonError,
        invocationArn,
        responseText: responseText.substring(0, 200),
      });
      throw new AssistantError(
        "Bedrock async poll returned invalid JSON response",
        ErrorType.PROVIDER_ERROR,
      );
    }

    const eventId = pollResponse.headers.get("cf-aig-event-id");
    const logId = pollResponse.headers.get("cf-aig-log-id");
    const cacheStatus = pollResponse.headers.get("cf-aig-cache-status");

    if (eventId || logId || cacheStatus) {
      pollData = {
        ...pollData,
        eventId,
        log_id: logId,
        cacheStatus,
      };
    }

    const status =
      pollData.status || pollData.invocationStatus || pollData.response?.status;

    return { data: pollData, status };
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
            s3Uri: `s3://${this.getEmbeddingsBucket(params)}/${params.model}/${params.completion_id || Date.now()}`,
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
      const prompt = await this.getInputPromptFromMessages(params);
      const bucket = this.getEmbeddingsBucket(params);
      const sanitizedBucket = bucket.replace(/^s3:\/\//, "");
      const outputPrefix = `${params.model}/${params.completion_id || Date.now()}`;
      const s3Uri = `s3://${sanitizedBucket}/${outputPrefix}/`;
      const bucketOwner = params.env.EMBEDDINGS_OUTPUT_BUCKET_OWNER;

      const s3OutputDataConfig: Record<string, string> = {
        s3Uri,
      };

      if (bucketOwner) {
        s3OutputDataConfig.bucketOwner = bucketOwner;
      }

      return {
        modelId: params.model,
        modelInput: {
          taskType: "TEXT_VIDEO",
          textToVideoParams: {
            text: prompt,
          },
          videoGenerationConfig: {
            durationSeconds: 6,
            fps: 24,
            dimension: "1280x720",
          },
        },
        outputDataConfig: {
          s3OutputDataConfig: {
            ...s3OutputDataConfig,
          },
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

    const bedrockMessages = formatBedrockMessages(params);

    return {
      ...(params.system_prompt && {
        system: [{ text: params.system_prompt }],
      }),
      messages: bedrockMessages,
      inferenceConfig: {
        temperature: commonParams.temperature,
        maxTokens: commonParams.max_tokens,
        topP: commonParams.top_p,
      },
      ...toolConfig,
    };
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

  private async enhanceAsyncResult(
    formatted: any,
    raw: Record<string, any>,
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    try {
      const modelConfig = await getModelConfigByMatchingModel(
        params.model || "",
      );
      const types = modelConfig?.type || [];
      const isVideoType =
        types.includes("text-to-video") || types.includes("image-to-video");

      if (!isVideoType) {
        return formatted;
      }

      const videoUrl = formatted?.outputDataConfig?.s3OutputDataConfig?.s3Uri;

      let responseText = "";
      if (!videoUrl) {
        responseText = "Your video is being processed...";
      } else {
        responseText = `Your video is ready. You will find the video here: ${videoUrl}`;
      }

      const mergedData: Record<string, any> = {
        ...(formatted?.data || {}),
      };

      return {
        ...formatted,
        response: responseText,
        data: mergedData,
      };
    } catch (error) {
      logger.error("Failed to enhance Bedrock async result", {
        error,
        model: params.model,
      });

      return {
        ...formatted,
        response: formatted.response || "Failed to enhance video result.",
      };
    }
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
    const region = this.getRegion();

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

    const region = this.getRegion();
    const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/count-tokens`;
    const body = {
      input: {
        converse: {
          ...(params.system_prompt && {
            system: [{ text: params.system_prompt }],
          }),
          messages: formatBedrockMessages(params),
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

    const region = this.getRegion();
    const modelConfig = await getModelConfigByMatchingModel(params.model || "");
    const operationPath = this.resolveOperationPath(params, modelConfig);
    const { awsUrl: bedrockUrl, cloudflarePath } = this.buildOperationPaths(
      params,
      operationPath,
      region,
    );
    const body = await this.mapParameters(params);

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        const { accessKey, secretKey } = await this.getAwsCredentials(
          params,
          userId,
        );
        const awsClient = new AwsClient({
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
          region,
          service: "bedrock",
        });

        const baseHeaders = await this.getHeaders(params);
        const serializedBody = JSON.stringify(body);

        const presignedRequest = await awsClient.sign(bedrockUrl, {
          method: "POST",
          headers: { ...baseHeaders },
          body: serializedBody,
        });

        if (!presignedRequest.url) {
          throw new AssistantError(
            "Failed to get presigned request from Bedrock",
          );
        }

        const signedUrl = new URL(presignedRequest.url);
        signedUrl.host = "gateway.ai.cloudflare.com";

        signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/${cloudflarePath}`;

        const response = await fetch(signedUrl, {
          method: "POST",
          headers: presignedRequest.headers,
          body: serializedBody,
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error("Failed to get response from Bedrock", {
            model: params.model,
            operation: operationPath,
            error: errorText.substring(0, 200),
          });
          throw new AssistantError("Failed to get response from Bedrock");
        }

        const isAsyncOperation = this.isAsyncOperation(operationPath);
        const isStreaming = params.stream && !isAsyncOperation;

        if (isStreaming) {
          const eventStreamParser = createEventStreamParser();
          return response.body.pipeThrough(eventStreamParser);
        }

        if (isAsyncOperation) {
          let initialData: Record<string, any>;
          try {
            initialData = (await response.json()) as Record<string, any>;
          } catch (jsonError) {
            const responseText = await response.text();
            logger.error(`Failed to parse async response from ${this.name}`, {
              error: jsonError,
              responseText: responseText.substring(0, 200),
            });
            throw new AssistantError(
              `${this.name} returned invalid JSON response: ${jsonError instanceof Error ? jsonError.message : "Unknown JSON parse error"}`,
              ErrorType.PROVIDER_ERROR,
            );
          }

          const invocationArn =
            initialData.invocationArn ||
            initialData.arn ||
            initialData.response?.invocationArn;

          if (!invocationArn) {
            logger.error("Missing invocationArn from async Bedrock response", {
              initialData,
            });
            throw new AssistantError(
              "Bedrock async invoke did not return an invocationArn",
              ErrorType.PROVIDER_ERROR,
            );
          }

          const encodedArn = encodeURIComponent(invocationArn);
          const invocationUrl = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/async-invoke/${encodedArn}`;

          const placeholderContent = [
            {
              type: "text" as const,
              text: "Video generation in progress. We'll update this message once the results are ready.",
            },
          ];

          const asyncInvocationData = createAsyncInvocationMetadata({
            provider: this.name,
            id: invocationArn,
            type: "bedrock.asyncInvoke",
            pollIntervalMs: 6000,
            initialResponse: initialData,
            context: {
              region,
              invocationArn,
              invocationUrl,
              operation: operationPath,
            },
            contentHints: {
              placeholder: placeholderContent,
              failure: [
                {
                  type: "text",
                  text: "Video generation failed. Please try again.",
                },
              ],
            },
          });

          return {
            response: placeholderContent,
            status: "in_progress",
            data: {
              asyncInvocation: asyncInvocationData,
            },
          };
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

  async getAsyncInvocationStatus(
    metadata: AsyncInvocationMetadata,
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<{
    status: "in_progress" | "completed" | "failed";
    result?: any;
    raw: Record<string, any>;
  }> {
    const invocationArn = metadata.context?.invocationArn ?? metadata.id;
    const initialResponse = metadata.initialResponse;

    const region =
      metadata.context?.region ??
      params.env.BEDROCK_AWS_REGION ??
      this.getRegion();
    const { accessKey, secretKey } = await this.getAwsCredentials(
      params,
      userId,
    );

    const awsClient = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      region,
      service: "bedrock",
    });

    const baseHeaders = await this.getHeaders(params);
    const { data, status } = await this.fetchAsyncInvokeStatus(
      awsClient,
      invocationArn,
      params,
      region,
      baseHeaders,
    );

    const mergedData = {
      ...(initialResponse || {}),
      ...data,
      invocationArn,
    };

    const normalizedStatus = (status || "IN_PROGRESS")
      .toString()
      .toUpperCase() as AsyncOperationStatus;

    if (
      normalizedStatus === "SUCCEEDED" ||
      normalizedStatus === "SUCCESS" ||
      normalizedStatus === "COMPLETED"
    ) {
      const formatted = await this.formatResponse(mergedData, params);
      const enhanced = await this.enhanceAsyncResult(
        formatted,
        mergedData,
        params,
        userId,
      );
      return {
        status: "completed",
        result: enhanced,
        raw: mergedData,
      };
    }

    if (
      normalizedStatus === "FAILED" ||
      normalizedStatus === "ERROR" ||
      normalizedStatus === "CANCELLED" ||
      normalizedStatus === "TIMED_OUT"
    ) {
      return {
        status: "failed",
        raw: mergedData,
      };
    }

    return {
      status: "in_progress",
      raw: mergedData,
    };
  }
}
