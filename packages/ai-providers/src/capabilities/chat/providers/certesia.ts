import { fetchAIResponse } from "../../../fetch.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { BaseProvider } from "./base.js";

export class CertesiaProvider extends BaseProvider {
  name = "cartesia";
  supportsStreaming = false;
  voice_id = "4f7f1324-1853-48a6-b294-4e78e8036a83";
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "CARTESIA_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  protected async getEndpoint(): Promise<string> {
    return "tts/bytes";
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.context?.user?.id);
    const baseHeaders = this.buildAiGatewayHeaders(params, apiKey);

    delete baseHeaders.Authorization;
    delete baseHeaders.authorization;

    return {
      ...baseHeaders,
      "X-API-Key": apiKey,
      "Cartesia-Version": "2026-03-01",
    };
  }

  async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
    this.validateParams(params);

    const endpoint = await this.getEndpoint();
    const headers = await this.getHeaders(params);

    const body = {
      transcript: params.message,
      model_id: params.model,
      language: "en",
      voice: {
        mode: "id",
        id: this.voice_id,
      },
      output_format: {
        container: "mp3",
        bit_rate: 128000,
        sample_rate: 44100,
      },
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
    });
  }
}
