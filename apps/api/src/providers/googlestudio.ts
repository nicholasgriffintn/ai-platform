import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";

export class GoogleStudioProvider extends BaseProvider {
  name = "google-ai-studio";
  supportsStreaming = false;

  protected getProviderKeyName(): string {
    return "GOOGLE_STUDIO_API_KEY";
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

  protected getEndpoint(params: ChatCompletionParameters): string {
    return `v1beta/models/${params.model}:generateContent`;
  }

  protected async getHeaders(
    params: ChatCompletionParameters,
  ): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey(params, params.user?.id);

    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email || "anonymous@undefined.computer",
      }),
    };
  }
}
