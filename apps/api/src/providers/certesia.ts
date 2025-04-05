import { trackProviderMetrics } from "../lib/monitoring";
import type { ChatCompletionParameters } from "../types";
import { AssistantError, ErrorType } from "../utils/errors";
import { BaseProvider } from "./base";
import { fetchAIResponse } from "./fetch";

export class CertesiaProvider extends BaseProvider {
  name = "certesia";
  supportsStreaming = false;
  voice_id = "87748186-23bb-4158-a1eb-332911b0b708"; // Wizardman

  protected getProviderKeyName(): string {
    return "CERTESIA_API_TOKEN";
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

  protected getEndpoint(): string {
    return "tts/bytes";
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      "X-API-Key": `Bearer ${apiKey}`,
      "Cartesia-Version": "2024-06-10",
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email || "anonymous@undefined.computer",
      }),
    };
  }

  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    this.validateParams(params);

    const endpoint = this.getEndpoint();
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

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        const data = await fetchAIResponse(
          this.name,
          endpoint,
          headers,
          body,
          params.env,
        );

        return this.formatResponse(data, params);
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
      },
      userId,
      completion_id: params.completion_id,
    });
  }
}
