import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class GrokProvider extends BaseProvider {
  name = "grok";
  supportsStreaming = true;
  isOpenAiCompatible = true;

  protected getProviderKeyName(): string {
    return "GROK_API_KEY";
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
