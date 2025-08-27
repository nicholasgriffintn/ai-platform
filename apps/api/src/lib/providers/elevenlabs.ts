import { trackProviderMetrics } from "~/lib/monitoring";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";
import { fetchAIResponse } from "./fetch";

export class ElevenLabsProvider extends BaseProvider {
  name = "elevenlabs";
  supportsStreaming = false;
  private readonly voiceId = "JBFqnCBsd6RMkjVDRZzb";
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "ELEVENLABS_API_KEY";
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

  protected async getEndpoint(): Promise<string> {
    return `v1/text-to-speech/${this.voiceId}`;
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      "xi-api-key": `Bearer ${apiKey}`,
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email,
        userId: params.user?.id,
        platform: params.platform,
        completionId: params.completion_id,
      }),
    };
  }

  async getResponse(
    params: ChatCompletionParameters,
    userId?: number,
  ): Promise<any> {
    this.validateParams(params);

    const endpoint = await this.getEndpoint();
    const headers = await this.getHeaders(params);

    const body = {
      text: params.message,
      model_id: params.model,
      output_format: "mp3_44100_128",
    };

    return trackProviderMetrics({
      provider: this.name,
      model: params.model as string,
      operation: async () => {
        const data = await fetchAIResponse(
          this.isOpenAiCompatible,
          this.name,
          endpoint,
          headers,
          body,
          params.env,
        );

        return await this.formatResponse(data, params);
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
