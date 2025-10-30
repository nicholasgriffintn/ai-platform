import { gatewayId } from "~/constants/app";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import { StorageService } from "~/lib/storage";
import { uploadAudioFromChat, uploadImageFromChat } from "~/lib/upload";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
  createCommonParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "~/utils/parameters";
import { BaseProvider } from "./base";
import { getAiGatewayMetadataHeaders } from "~/utils/aiGateway";

const logger = getLogger({ prefix: "lib/providers/workers" });

export class WorkersProvider extends BaseProvider {
  name = "workers-ai";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return null;
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected async getEndpoint(): Promise<string> {
    return "";
  }

  protected getHeaders(): Record<string, string> {
    return {};
  }

  async mapParameters(
    params: ChatCompletionParameters,
    storageService?: StorageService,
    assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const modelConfig = await getModelConfigByMatchingModel(params.model || "");
    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${params.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const type = modelConfig?.type || ["text"];

    let imageData: any;
    if (
      type.includes("image-to-text") ||
      type.includes("image-to-image") ||
      type.includes("text-to-image") ||
      type.includes("text-to-speech")
    ) {
      if (
        params.messages.length > 2 ||
        (params.messages.length === 2 && params.messages[0].role !== "system")
      ) {
        throw new AssistantError(
          "You cannot use images with more than 2 user messages, Please start a new conversation.",
          ErrorType.PARAMS_ERROR,
        );
      }

      try {
        let imageContent = null;
        for (const message of params.messages) {
          if (Array.isArray(message.content)) {
            const imageContentItem = message.content.find(
              (item) => "image_url" in item,
            );
            if (imageContentItem) {
              // @ts-ignore - types are wrong
              imageContent = imageContentItem.image_url.url;
              break;
            }
          } else if (
            typeof message.content === "object" &&
            message.content &&
            // @ts-ignore - types are wrong
            message.content.image
          ) {
            // @ts-ignore - types are wrong
            imageContent = message.content.image;
            break;
          }
        }

        if (imageContent) {
          const isUrl = imageContent.startsWith("http");

          if (type.includes("image-to-text")) {
            let base64Data = null;

            if (isUrl) {
              if (!assetsUrl) {
                throw new AssistantError(
                  "Assets URL is required for image URL processing",
                  ErrorType.CONFIGURATION_ERROR,
                );
              }

              const isFirstPartyUrl = imageContent.startsWith(assetsUrl);

              if (!isFirstPartyUrl) {
                throw new AssistantError(
                  "Image URL must be from the same domain as the assets URL",
                  ErrorType.PARAMS_ERROR,
                );
              }

              if (!storageService) {
                throw new AssistantError(
                  "Storage service is required for image URL processing",
                  ErrorType.CONFIGURATION_ERROR,
                );
              }

              const imageKeyFromUrl = imageContent.replace(assetsUrl, "");
              const retrievedImageData =
                await storageService?.getObject(imageKeyFromUrl);
              base64Data = retrievedImageData;
            } else {
              base64Data = imageContent;
            }

            if (!base64Data) {
              throw new AssistantError(
                "No image data found",
                ErrorType.PARAMS_ERROR,
              );
            }

            try {
              const binary = atob(base64Data);
              const array = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                array[i] = binary.charCodeAt(i);
              }

              if (array.length === 0) {
                throw new AssistantError(
                  "No image data found after processing",
                  ErrorType.PARAMS_ERROR,
                );
              }
              imageData = Array.from(array);
            } catch (binaryError: any) {
              throw new AssistantError(
                `Failed to process image data: ${binaryError.message}`,
                ErrorType.PARAMS_ERROR,
              );
            }
          }
        } else {
          imageData = imageContent;
        }
      } catch (error: any) {
        throw new AssistantError(
          `Error processing image data: ${error.message}`,
          ErrorType.PARAMS_ERROR,
        );
      }

      let prompt = null;

      if (params.messages.length >= 2 && params.messages[0].role === "system") {
        let systemContent = "";
        if (Array.isArray(params.messages[0].content)) {
          const contentItem = params.messages[0].content[0];

          if (contentItem && typeof contentItem === "object") {
            if (contentItem.type === "text" && contentItem.text) {
              systemContent = contentItem.text;
            } else if ("text" in contentItem) {
              systemContent = contentItem.text;
            }
          }
        } else if (typeof params.messages[0].content === "string") {
          systemContent = params.messages[0].content;
        } else {
          // @ts-ignore - types might be wrong
          systemContent = params.messages[0].content?.text || "";
        }

        let userContent = "";
        if (Array.isArray(params.messages[1].content)) {
          const contentItem = params.messages[1].content[0];
          if (contentItem && typeof contentItem === "object") {
            if (contentItem.type === "text" && contentItem.text) {
              userContent = contentItem.text;
            } else if ("text" in contentItem) {
              userContent = contentItem.text;
            }
          }
        } else if (typeof params.messages[1].content === "string") {
          userContent = params.messages[1].content;
        } else {
          // @ts-ignore - types might be wrong
          userContent = params.messages[1].content?.text || "";
        }

        prompt = `${systemContent}\n\n${userContent}`;
      } else {
        if (Array.isArray(params.messages[0].content)) {
          const contentItem = params.messages[0].content[0];
          if (contentItem && typeof contentItem === "object") {
            if (contentItem.type === "text" && contentItem.text) {
              prompt = contentItem.text;
            } else if ("text" in contentItem) {
              prompt = contentItem.text;
            }
          }
        } else if (typeof params.messages[0].content === "string") {
          prompt = params.messages[0].content;
        } else {
          // @ts-ignore - types might be wrong
          prompt = params.messages[0].content?.text;
        }
      }

      if (!imageData && !type.includes("text-to-image")) {
        throw new AssistantError(
          "No image data found in the request",
          ErrorType.PARAMS_ERROR,
        );
      }

      if (!prompt) {
        const result: any = { prompt: "" };
        if (imageData) {
          result.image = imageData;
        }
        return result;
      }

      const result: any = { prompt };
      if (imageData) {
        result.image = imageData;
      }
      return result;
    }

    const commonParams = createCommonParameters(
      params,
      modelConfig,
      this.name,
      this.isOpenAiCompatible,
    );

    const streamingParams = shouldEnableStreaming(
      modelConfig,
      this.supportsStreaming,
      params.stream,
    )
      ? { stream: true }
      : {};

    const toolsParams = getToolsForProvider(params, modelConfig, this.name);
    const supportsToolCalls = modelConfig?.supportsToolCalls || false;

    const toolConfig = supportsToolCalls
      ? { toolConfig: { tools: toolsParams.tools } }
      : {};

    return {
      ...commonParams,
      ...streamingParams,
      ...toolConfig,
      stop: params.stop,
      n: params.n,
      random_seed: params.seed,
      messages: params.messages,
    };
  }

  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    const { model, env, user } = params;

    if (!model) {
      throw new AssistantError("Missing model", ErrorType.PARAMS_ERROR);
    }

    const storageService = new StorageService(env.ASSETS_BUCKET);
    const body = await this.mapParameters(
      params,
      storageService,
      env.PUBLIC_ASSETS_URL,
    );

    return trackProviderMetrics({
      provider: "workers-ai",
      model,
      operation: async () => {
        // @ts-ignore
        const modelResponse = await env.AI.run(model, body, {
          gateway: {
            id: gatewayId,
            skipCache: false,
            cacheTtl: 7200,
            authorization: env.AI_GATEWAY_TOKEN,
            metadata: getAiGatewayMetadataHeaders(params),
          },
        });

        const modelConfig = await getModelConfigByMatchingModel(model);
        const type = modelConfig?.type || ["text"];

        const responseWasStreamed = body.stream;

        if (
          // @ts-ignore
          modelResponse?.image ||
          (modelResponse && type.includes("text-to-image")) ||
          type.includes("image-to-image")
        ) {
          try {
            const imageKey = `generations/${
              params.completion_id
            }/${model}/${Date.now()}.png`;
            const upload = await uploadImageFromChat(
              // @ts-ignore
              modelResponse.image || modelResponse,
              env,
              imageKey,
            );

            if (!upload) {
              throw new AssistantError(
                "Failed to upload image",
                ErrorType.PROVIDER_ERROR,
              );
            }

            const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";

            const imageResponse = {
              response: "Image Generated.",
              data: {
                attachments: [
                  {
                    type: "image",
                    url: `${baseAssetsUrl}/${imageKey}`,
                    key: upload,
                  },
                ],
              },
            };

            if (responseWasStreamed) {
              return imageResponse;
            }

            return await this.formatResponse(imageResponse, params);
          } catch (error) {
            logger.error("Error generating image", { error });
            return "";
          }
        } else if (
          // @ts-ignore
          modelResponse?.audio ||
          (modelResponse && type.includes("text-to-speech"))
        ) {
          try {
            const audioKey = `generations/${
              params.completion_id
            }/${model}/${Date.now()}.mp3`;
            const upload = await uploadAudioFromChat(
              // @ts-ignore
              modelResponse.audio || modelResponse,
              env,
              audioKey,
            );

            if (!upload) {
              throw new AssistantError(
                "Failed to upload audio",
                ErrorType.PROVIDER_ERROR,
              );
            }

            const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";

            const audioResponse = {
              response: "Audio Generated.",
              data: {
                attachments: [
                  {
                    type: "audio",
                    url: `${baseAssetsUrl}/${audioKey}`,
                    key: upload,
                  },
                ],
              },
            };

            if (responseWasStreamed) {
              return audioResponse;
            }

            return await this.formatResponse(audioResponse, params);
          } catch (error) {
            logger.error("Error generating audio", { error });
            return "";
          }
        } else if (
          // @ts-ignore
          modelResponse?.description
        ) {
          const descriptionResponse = {
            // @ts-ignore - types are wrong
            response: modelResponse.description,
            data: modelResponse,
          };

          if (responseWasStreamed) {
            return descriptionResponse;
          }

          return await this.formatResponse(descriptionResponse, params);
        }

        if (responseWasStreamed) {
          return modelResponse;
        }

        return await this.formatResponse(modelResponse, params);
      },
      analyticsEngine: env.ANALYTICS,
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
