import type { ChatCompletionParameters } from "../types";
import { AssistantError, ErrorType } from "../utils/errors";
import { BaseProvider } from "./base";

export class GoogleStudioProvider extends BaseProvider {
  name = "google-ai-studio";
  supportsStreaming = false;

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (!params.env.GOOGLE_STUDIO_API_KEY || !params.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing GOOGLE_STUDIO_API_KEY or AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  protected getEndpoint(params: ChatCompletionParameters): string {
    const isBeta = params.model?.includes("gemini-exp");
    return `${isBeta ? "v1beta" : "v1"}/models/${params.model}:generateContent`;
  }

  protected getHeaders(
    params: ChatCompletionParameters,
  ): Record<string, string> {
    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      "x-goog-api-key": params.env.GOOGLE_STUDIO_API_KEY || "",
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email || "anonymous@undefined.computer",
      }),
    };
  }
}
