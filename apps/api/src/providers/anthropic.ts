import type { ChatCompletionParameters } from "../types/chat";
import { AssistantError, ErrorType } from "../utils/errors";
import { BaseProvider } from "./base";

export class AnthropicProvider extends BaseProvider {
  name = "anthropic";
  supportsStreaming = true;

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (!params.env.ANTHROPIC_API_KEY || !params.env.AI_GATEWAY_TOKEN) {
      throw new AssistantError(
        "Missing ANTHROPIC_API_KEY or AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  protected getEndpoint(): string {
    return "v1/messages";
  }

  protected getHeaders(
    params: ChatCompletionParameters,
  ): Record<string, string> {
    return {
      "cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
      "x-api-key": params.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify({
        email: params.user?.email || "anonymous@undefined.computer",
      }),
    };
  }
}
