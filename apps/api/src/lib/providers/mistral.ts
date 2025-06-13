import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
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

    if (!params.env.MISTRAL_API_KEY || !params.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  protected getEndpoint(params: ChatCompletionParameters): string {
    if (params.model === "mistral-ocr-latest") {
      return "v1/ocr";
    }

    return "v1/chat/completions";
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email,
      }),
    };
  }
}
