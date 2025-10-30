import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class MistralProvider extends BaseProvider {
  name = "mistral";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "MISTRAL_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);
    this.validateAiGatewayToken(params);
  }

  protected async getEndpoint(
    params: ChatCompletionParameters,
  ): Promise<string> {
    if (params.model === "mistral-ocr-latest") {
      return "v1/ocr";
    }

    return "v1/chat/completions";
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);
    return this.buildAiGatewayHeaders(params, apiKey);
  }
}
