import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class VercelGatewayProvider extends BaseProvider {
  name = "vercel";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "VERCEL_AI_GATEWAY_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
  }

  protected getEndpoint(): string {
    return "https://gateway.ai.vercel.com/v1/chat/completions";
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
