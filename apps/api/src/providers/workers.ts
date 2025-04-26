import { gatewayId } from "~/constants/app";
import { mapParametersToProvider } from "~/lib/chat/parameters";
import { trackProviderMetrics } from "~/lib/monitoring";
import { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";

export class WorkersProvider extends BaseProvider {
  name = "workers-ai";
  supportsStreaming = true;

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
              email: user?.email || "anonymous@undefined.computer",
            },
          },
        });

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
      },
      userId,
      completion_id: params.completion_id,
    });
  }
}
