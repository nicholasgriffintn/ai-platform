import { SPEECH_PROVIDER_VOICES } from "@ngriffin_uk/polychat-schemas";

import { fetchAIResponse } from "../../../fetch.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { BaseProvider } from "./base.js";

export class ElevenLabsProvider extends BaseProvider {
  name = "elevenlabs";
  supportsStreaming = false;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "ELEVENLABS_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  protected async getEndpoint(params?: ChatCompletionParameters): Promise<string> {
    const voice = params?.voice ?? SPEECH_PROVIDER_VOICES.elevenlabs.roles.narrator;

    return `v1/text-to-speech/${encodeURIComponent(voice)}`;
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);
    const baseHeaders = this.buildAiGatewayHeaders(params, apiKey);

    delete baseHeaders.Authorization;
    delete baseHeaders.authorization;

    return {
      ...baseHeaders,
      "xi-api-key": apiKey,
    };
  }

  async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
    this.validateParams(params);

    const endpoint = await this.getEndpoint(params);
    const headers = await this.getHeaders(params);

    const body = {
      text: params.message,
      model_id: params.model,
      output_format: "mp3_44100_128",
    };

    return trackProviderMetrics(this.runtime.host, {
      provider: this.name,
      model: this.requireModel(params),
      operation: async () => {
        const data = await fetchAIResponse(
          this.isOpenAiCompatible,
          this.name,
          endpoint,
          headers,
          body,
          params.env,
          {
            responseType: "raw",
          },
        );

        return data;
      },
      settings: this.buildMetricsSettings(params),
      userId,
      completion_id: params.completion_id,
      request: params,
    });
  }
}
