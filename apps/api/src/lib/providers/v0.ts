import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class V0Provider extends BaseProvider {
  name = "v0";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "V0_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected getEndpoint(): string {
    const voApiBaseUrl = "https://api.v0.dev/v1/";
    return `${voApiBaseUrl}chat/completions`;
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
