import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class ChutesProvider extends BaseProvider {
  name = "chutes";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "CHUTES_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected getEndpoint(): string {
    return "https://llm.chutes.ai/v1/chat/completions";
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }
}
