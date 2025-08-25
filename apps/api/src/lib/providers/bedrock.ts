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
    
    // TwelveLabs models use different endpoints
    if (this.isTwelveLabsModel(params.model)) {
      if (this.isPegasusModel(params.model)) {
        // Pegasus uses InvokeModel/InvokeModelWithResponseStream
        if (params.stream) {
          return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/invoke-with-response-stream`;
        }
        return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/invoke`;
      } else if (this.isMarengoModel(params.model)) {
        // Marengo uses StartAsyncInvoke
        return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/start-async-invoke`;
      }
    }
    
    // Default converse API for other models
    if (params.stream) {
      return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/converse-stream`;
    }
    return `https://bedrock-runtime.${region}.amazonaws.com/model/${params.model}/converse`;
  }

  protected getHeaders(): Record<string, string> {
    return {};
  }

  private isTwelveLabsModel(model: string): boolean {
    return model.startsWith('twelvelabs.');
  }

  private isPegasusModel(model: string): boolean {
    return model.includes('pegasus');
  }

  private isMarengoModel(model: string): boolean {
    return model.includes('marengo');
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

    // Handle TwelveLabs models with different parameter formats
    if (this.isTwelveLabsModel(params.model)) {
      return this.mapTwelveLabsParameters(params, commonParams);
    }

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
   * Map parameters specifically for TwelveLabs models
   */
  private mapTwelveLabsParameters(
    params: ChatCompletionParameters,
    commonParams: any,
  ): Record<string, any> {
    if (this.isPegasusModel(params.model)) {
      // Pegasus model for video analysis
      const lastMessage = params.messages[params.messages.length - 1];
      let prompt = "";
      let videoUrl = "";
      
      if (Array.isArray(lastMessage.content)) {
        for (const content of lastMessage.content) {
          if (content.type === 'text') {
            prompt = content.text;
          } else if (content.type === 'video_url' && content.video_url) {
            videoUrl = content.video_url.url;
          }
        }
      } else if (typeof lastMessage.content === 'string') {
        prompt = lastMessage.content;
      }
      
      return {
        prompt,
        ...(videoUrl && { video_url: videoUrl }),
        temperature: commonParams.temperature,
        max_tokens: commonParams.max_tokens,
        top_p: commonParams.top_p,
      };
    } else if (this.isMarengoModel(params.model)) {
      // Marengo model for embeddings
      const lastMessage = params.messages[params.messages.length - 1];
      let text = "";
      let videoUrl = "";
      
      if (Array.isArray(lastMessage.content)) {
        for (const content of lastMessage.content) {
          if (content.type === 'text') {
            text = content.text;
          } else if (content.type === 'video_url' && content.video_url) {
            videoUrl = content.video_url.url;
          }
        }
      } else if (typeof lastMessage.content === 'string') {
        text = lastMessage.content;
      }
      
      return {
        input_type: "video",
        ...(videoUrl && { video_url: videoUrl }),
        ...(text && { text }),
      };
    }
    
    // Fallback to standard format
    return {
      messages: this.formatBedrockMessages(params),
      temperature: commonParams.temperature,
      max_tokens: commonParams.max_tokens,
      top_p: commonParams.top_p,
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

    const presignedRequest = await awsClient.sign(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!presignedRequest.url) {
      throw new AssistantError("Failed to get presigned request from Bedrock");
    }

    const signedUrl = new URL(presignedRequest.url);
    signedUrl.host = "gateway.ai.cloudflare.com";
    
    // Set the correct pathway based on model type and operation
    if (this.isTwelveLabsModel(params.model)) {
      if (this.isPegasusModel(params.model)) {
        if (operation === "invoke-with-response-stream") {
          signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/invoke-with-response-stream`;
        } else {
          signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/invoke`;
        }
      } else if (this.isMarengoModel(params.model)) {
        signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/start-async-invoke`;
      }
    } else {
      signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/${operation}`;
    }

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

    const bedrockUrl = this.getEndpoint(params);
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

        // Set the correct pathway based on model type
        if (this.isTwelveLabsModel(params.model)) {
          if (this.isPegasusModel(params.model)) {
            // Pegasus uses InvokeModel/InvokeModelWithResponseStream
            if (params.stream) {
              signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/invoke-with-response-stream`;
            } else {
              signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/invoke`;
            }
          } else if (this.isMarengoModel(params.model)) {
            // Marengo uses StartAsyncInvoke
            signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/start-async-invoke`;
          }
        } else {
          // Default converse API for other models
          if (params.stream) {
            signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/converse-stream`;
          } else {
            signedUrl.pathname = `/v1/${params.env.ACCOUNT_ID}/${gatewayId}/aws-bedrock/bedrock-runtime/${region}/model/${params.model}/converse`;
          }
        }

        const response = await fetch(signedUrl, {
          method: "POST",
          headers: presignedRequest.headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new AssistantError("Failed to get response from Bedrock");
        }

        // Handle async invoke for Marengo model
        if (this.isMarengoModel(params.model)) {
          return this.handleAsyncInvokeResponse(response, params);
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

        // Handle TwelveLabs model responses
        if (this.isTwelveLabsModel(params.model)) {
          return this.formatTwelveLabsResponse(data, params);
        }

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

  /**
   * Handle async invoke response for Marengo embedding model
   */
  private async handleAsyncInvokeResponse(response: Response, params: ChatCompletionParameters): Promise<any> {
    const data = await response.json() as any;
    
    // For async invoke, we get an invocation ARN that can be used to check status
    if (data.invocationArn) {
      // For now, return a simple response indicating the async operation started
      // In a full implementation, you might want to poll for results or use webhooks
      return {
        response: "Embedding generation started successfully",
        invocationArn: data.invocationArn,
        status: "IN_PROGRESS"
      };
    }
    
    return data;
  }

  /**
   * Format responses from TwelveLabs models
   */
  private formatTwelveLabsResponse(data: any, params: ChatCompletionParameters): any {
    if (this.isPegasusModel(params.model)) {
      // Pegasus returns text analysis of video
      if (data.output && data.output.text) {
        return {
          response: data.output.text,
          usage: data.usage || null,
        };
      } else if (data.completion) {
        return {
          response: data.completion,
          usage: data.usage || null,
        };
      } else if (typeof data === 'string') {
        return {
          response: data,
          usage: null,
        };
      }
    } else if (this.isMarengoModel(params.model)) {
      // Marengo returns embeddings
      if (data.embeddings) {
        return {
          response: "Embeddings generated successfully",
          embeddings: data.embeddings,
          usage: data.usage || null,
        };
      }
    }
    
    // Fallback to standard format
    return this.formatResponse(data, params);
  }
}
