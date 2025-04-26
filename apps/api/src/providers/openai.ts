import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";

export class OpenAIProvider extends BaseProvider {
  name = "openai";
  supportsStreaming = true;

  protected getProviderKeyName(): string {
    return "OPENAI_API_KEY";
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

  private isImageGeneration(params: ChatCompletionParameters): boolean {
    return params.model === "gpt-image-1";
  }

  protected getEndpoint(params: ChatCompletionParameters): string {
    if (this.isImageGeneration(params)) {
      const hasAttachments = params.messages.some(
        (message) =>
          Array.isArray(message.content) &&
          message.content.some((c) => c.type === "image_url"),
      );
      return hasAttachments ? "images/edits" : "images/generations";
    }
    return "chat/completions";
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
        email: params.user?.email || "anonymous@undefined.computer",
      }),
    };
  }
}
