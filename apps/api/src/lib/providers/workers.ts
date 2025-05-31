import { gatewayId } from "~/constants/app";
import { mapParametersToProvider } from "~/lib/chat/parameters";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { trackProviderMetrics } from "~/lib/monitoring";
import { StorageService } from "~/lib/storage";
import { uploadAudioFromChat, uploadImageFromChat } from "~/lib/upload";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { BaseProvider } from "./base";

const logger = getLogger({ prefix: "WORKERS" });

export class WorkersProvider extends BaseProvider {
  name = "workers-ai";
  supportsStreaming = true;
  isOpenAiCompatible = true;

  protected getProviderKeyName(): string {
    return null;
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected getEndpoint(): string {
    return "";
  }

  protected getHeaders(): Record<string, string> {
    return {};
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
    const body = await mapParametersToProvider(
      this.isOpenAiCompatible,
      params,
      "workers-ai",
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
            cacheTtl: 3360,
            authorization: env.AI_GATEWAY_TOKEN,
            metadata: {
              email: user?.email,
            },
          },
        });

        const modelConfig = getModelConfigByMatchingModel(model);
        const type = modelConfig?.type || ["text"];

        if (
          // @ts-ignore
          modelResponse?.image ||
          (modelResponse && type.includes("text-to-image")) ||
          type.includes("image-to-image")
        ) {
          try {
            const imageKey = `generations/${params.completion_id}/${model}/${Date.now()}.png`;
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

            return {
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
            const audioKey = `generations/${params.completion_id}/${model}/${Date.now()}.mp3`;
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

            return {
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
          } catch (error) {
            logger.error("Error generating audio", { error });
            return "";
          }
        } else if (
          // @ts-ignore
          modelResponse?.description
        ) {
          return {
            // @ts-ignore - types of wrong
            response: modelResponse.description,
            data: modelResponse,
          };
        }

        return modelResponse;
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
      },
      userId,
      completion_id: params.completion_id,
    });
  }
}
