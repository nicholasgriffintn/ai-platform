import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import {
  buildMultipartInput,
  type MultipartInputFile,
} from "@ngriffin_uk/polychat-utility-server/multipart-input";

import { resolveAiGatewayId, getAiGatewayMetadataHeaders } from "../../../gateway.js";
import { persistGeneratedOutput } from "../../../generated-media.js";
import type { ProviderStorage } from "../../../host.js";
import { buildInputSchemaInput } from "../../../input-schema.js";
import { requireMessages } from "../../../messages.js";
import { trackProviderMetrics } from "../../../metrics.js";
import {
  createCommonParameters,
  createWorkersReasoningParameters,
  getToolsForProvider,
  shouldEnableStreaming,
} from "../../../parameters.js";
import type { ChatCompletionParameters, Message } from "../../../types/index.js";
import { BaseProvider } from "./base.js";

const logger = getLogger({ prefix: "lib/providers/workers" });

type WorkersMediaPayload = {
  prompt: string;
  image?: number[] | string;
  lang?: string;
};

function getModalityFlags(modelConfig?: ModelConfigItem | null) {
  const inputs = modelConfig?.modalities?.input ?? ["text"];
  const outputs = modelConfig?.modalities?.output ?? inputs;

  return {
    supportsTextInput: inputs.includes("text"),
    isImageToText: inputs.includes("image") && outputs.includes("text"),
    isImageToImage: inputs.includes("image") && outputs.includes("image"),
    isTextToImage: !inputs.includes("image") && outputs.includes("image"),
    isTextToSpeech:
      inputs.includes("text") && (outputs.includes("audio") || outputs.includes("speech")),
  };
}

function messageContentHasImage(content: unknown): boolean {
  if (Array.isArray(content)) {
    return content.some((item) => {
      return (
        item &&
        typeof item === "object" &&
        "image_url" in item &&
        typeof item.image_url === "object" &&
        item.image_url !== null &&
        "url" in item.image_url
      );
    });
  }

  return (
    content !== null &&
    typeof content === "object" &&
    "image" in content &&
    typeof content.image === "string" &&
    content.image.length > 0
  );
}

function requestHasImageInput(params: ChatCompletionParameters): boolean {
  return params.messages?.some((message) => messageContentHasImage(message.content)) ?? false;
}

function getContentImage(content: Message["content"]) {
  if (Array.isArray(content)) {
    const imageItem = content.find((item) => item.type === "image_url" && item.image_url?.url);

    if (imageItem?.image_url?.url) {
      return imageItem.image_url.url;
    }

    const inlineImageItem = content.find((item) => typeof item.image === "string");

    if (typeof inlineImageItem?.image === "string") {
      return inlineImageItem.image;
    }

    return null;
  }

  if (isRecord(content) && typeof content.image === "string") {
    return content.image;
  }

  return null;
}

function getContentText(content: Message["content"]) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textItem = content.find((item) => typeof item.text === "string");

    return typeof textItem?.text === "string" ? textItem.text : "";
  }

  return isRecord(content) && typeof content.text === "string" ? content.text : "";
}

function decodeBase64ImageData(base64Data: string) {
  const payload = base64Data.startsWith("data:") ? base64Data.split(",", 2)[1] || "" : base64Data;
  const binary = atob(payload);
  const array = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }

  if (array.length === 0) {
    throw new AssistantError("No image data found after processing", ErrorType.PARAMS_ERROR);
  }

  return Array.from(array);
}

type GeneratedOutput = ReadableStream | string | ArrayBuffer | Uint8Array;

function isGeneratedOutput(value: unknown): value is GeneratedOutput {
  return (
    typeof value === "string" ||
    value instanceof ArrayBuffer ||
    value instanceof Uint8Array ||
    value instanceof ReadableStream
  );
}

function getGeneratedOutput(
  modelResponse: unknown,
  field: "image" | "audio",
  useWholeResponse: boolean,
): GeneratedOutput | undefined {
  if (isRecord(modelResponse) && isGeneratedOutput(modelResponse[field])) {
    return modelResponse[field];
  }

  return useWholeResponse && isGeneratedOutput(modelResponse) ? modelResponse : undefined;
}

function getResponseDescription(modelResponse: unknown) {
  return isRecord(modelResponse) && typeof modelResponse.description === "string"
    ? modelResponse.description
    : undefined;
}

function toMultipartImage(
  imageData: NonNullable<WorkersMediaPayload["image"]>,
): MultipartInputFile {
  const source = typeof imageData === "string" ? atob(imageData) : imageData;
  const buffer = new ArrayBuffer(source.length);
  const view = new Uint8Array(buffer);

  for (let index = 0; index < source.length; index += 1) {
    view[index] = typeof source === "string" ? source.charCodeAt(index) : (source[index] ?? 0);
  }

  return { field: "image", data: buffer, filename: "image.png", contentType: "image/png" };
}

export class WorkersProvider extends BaseProvider {
  name = "workers-ai";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "";
  }

  protected async getEndpoint(): Promise<string> {
    return "";
  }

  protected getHeaders(): Record<string, string> {
    return {};
  }

  async mapParameters(
    params: ChatCompletionParameters,
    storageService?: ProviderStorage | null,
    assetsUrl?: string,
  ): Promise<Record<string, any>> {
    const modelConfig = await this.runtime.host.models.getModelConfigByMatchingModel(
      params.model || "",
      params.env,
      this.name,
    );

    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${params.model}`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    if (params.body?.input && modelConfig.inputSchema?.fields?.length) {
      const { input } = buildInputSchemaInput(params, modelConfig);

      return typeof input === "string" ? { prompt: input } : input;
    }

    const flags = getModalityFlags(modelConfig);
    const shouldUseMediaPayload =
      flags.isTextToImage ||
      flags.isTextToSpeech ||
      flags.isImageToImage ||
      (flags.isImageToText && (!flags.supportsTextInput || requestHasImageInput(params)));

    let imageData: WorkersMediaPayload["image"];

    if (shouldUseMediaPayload) {
      const messages = requireMessages(params);
      const [firstMessage, secondMessage] = messages;

      if (messages.length > 2 || (messages.length === 2 && firstMessage?.role !== "system")) {
        throw new AssistantError(
          "You cannot use images with more than 2 user messages, Please start a new conversation.",
          ErrorType.PARAMS_ERROR,
        );
      }

      try {
        const imageContent = messages
          .map((message) => getContentImage(message.content))
          .find((candidate): candidate is string => Boolean(candidate));

        if (imageContent) {
          const isUrl = imageContent.startsWith("http");

          if (flags.isImageToText) {
            let base64Data: string | null = null;

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

              base64Data = await storageService.getPrivateAssetImageDataUrl(
                imageContent,
                params.context?.user?.id,
                assetsUrl,
              );
            } else {
              base64Data = imageContent;
            }

            if (!base64Data) {
              throw new AssistantError("No image data found", ErrorType.PARAMS_ERROR);
            }

            try {
              imageData = decodeBase64ImageData(base64Data);
            } catch (binaryError) {
              throw new AssistantError(
                `Failed to process image data: ${getErrorMessage(binaryError)}`,
                ErrorType.PARAMS_ERROR,
              );
            }
          }
        } else {
          imageData = imageContent;
        }
      } catch (error) {
        throw new AssistantError(
          `Error processing image data: ${getErrorMessage(error)}`,
          ErrorType.PARAMS_ERROR,
        );
      }

      let prompt = "";

      if (firstMessage && secondMessage && firstMessage.role === "system") {
        prompt = `${getContentText(firstMessage.content)}\n\n${getContentText(secondMessage.content)}`;
      } else if (firstMessage) {
        prompt = getContentText(firstMessage.content);
      }

      if (flags.isTextToSpeech) {
        return {
          prompt: prompt || "",
          lang: params.lang ?? "en",
        };
      }

      if (!imageData && !flags.isTextToImage) {
        throw new AssistantError("No image data found in the request", ErrorType.PARAMS_ERROR);
      }

      if (modelConfig.inputFormat === "multipart") {
        return await buildMultipartInput(
          { prompt },
          imageData ? [toMultipartImage(imageData)] : [],
        );
      }

      if (!prompt) {
        const result: WorkersMediaPayload = { prompt: "" };

        if (imageData) {
          result.image = imageData;
        }

        return result;
      }

      const result: WorkersMediaPayload = { prompt };

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
      params.stream ?? false,
    )
      ? { stream: true }
      : {};

    const toolsParams = getToolsForProvider(params, modelConfig, this.name);
    const supportsToolCalls = modelConfig?.supportsToolCalls || false;

    const toolConfig = supportsToolCalls && toolsParams.tools ? toolsParams : {};

    return {
      ...commonParams,
      ...createWorkersReasoningParameters(params, modelConfig),
      ...streamingParams,
      ...toolConfig,
      stop: params.stop,
      n: params.n,
      random_seed: params.seed,
      messages: params.messages,
    };
  }

  async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
    const { model, env } = params;

    if (!model) {
      throw new AssistantError("Missing model", ErrorType.PARAMS_ERROR);
    }

    const storageService = this.runtime.host.storage.forEnv(env) ?? undefined;
    const body = await this.mapParameters(params, storageService, env.API_BASE_URL);
    const ai = env.AI;

    if (!ai) {
      throw new AssistantError("Missing AI binding", ErrorType.CONFIGURATION_ERROR);
    }

    return trackProviderMetrics(this.runtime.host, {
      provider: "workers-ai",
      model,
      operation: async () => {
        const modelResponse = await ai.run(model, body, {
          gateway: {
            id: resolveAiGatewayId(),
            skipCache: false,
            cacheTtl: 7200,
            metadata: getAiGatewayMetadataHeaders(params),
          },
        });

        const modelConfig = await this.runtime.host.models.getModelConfigByMatchingModel(
          model,
          env,
          this.name,
        );
        const responseFlags = getModalityFlags(modelConfig);

        const responseWasStreamed = body.stream;

        const imageOutput = getGeneratedOutput(
          modelResponse,
          "image",
          responseFlags.isTextToImage || responseFlags.isImageToImage,
        );

        if (imageOutput) {
          try {
            if (!params.context?.user?.id) {
              throw new AssistantError(
                "User ID is required to store generated image",
                ErrorType.FORBIDDEN,
                403,
              );
            }

            const storedImage = await persistGeneratedOutput({
              mediaContext: {
                storage: this.runtime.host.storage.forContext({
                  env,
                  user: params.context.user,
                }),
                model,
                completionId: params.completion_id,
                userId: params.context?.user.id,
              },
              output: imageOutput,
              extension: "png",
              mimeType: "image/png",
              filename: "image.png",
              dataUrlMimePattern: "image\\/\\w+",
            });

            const imageResponse = {
              response: "Image Generated.",
              data: {
                attachments: [
                  {
                    type: "image",
                    outputId: storedImage.outputId,
                    url: storedImage.url,
                    key: storedImage.key,
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
        }

        const audioOutput = getGeneratedOutput(
          modelResponse,
          "audio",
          responseFlags.isTextToSpeech,
        );

        if (audioOutput) {
          try {
            if (!params.context?.user?.id) {
              throw new AssistantError(
                "User ID is required to store generated audio",
                ErrorType.FORBIDDEN,
                403,
              );
            }

            const storedAudio = await persistGeneratedOutput({
              mediaContext: {
                storage: this.runtime.host.storage.forContext({
                  env,
                  user: params.context.user,
                }),
                model,
                completionId: params.completion_id,
                userId: params.context?.user.id,
              },
              output: audioOutput,
              extension: "mp3",
              mimeType: "audio/mpeg",
              filename: "audio.mp3",
              dataUrlMimePattern: "audio\\/\\w+",
            });

            const audioResponse = {
              response: "Audio Generated.",
              data: {
                attachments: [
                  {
                    type: "audio",
                    outputId: storedAudio.outputId,
                    url: storedAudio.url,
                    key: storedAudio.key,
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
        }

        const description = getResponseDescription(modelResponse);

        if (description) {
          const descriptionResponse = {
            response: description,
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
      request: params,
    });
  }
}
