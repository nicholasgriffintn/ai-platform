import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class OpenRouterProvider extends BaseProvider {
  name = "openrouter";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "OPENROUTER_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  protected async getEndpoint(): Promise<string> {
    return "v1/chat/completions";
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);
    return this.buildAiGatewayHeaders(params, apiKey);
  }
}
