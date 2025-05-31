import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseProvider } from "./base";

export class OllamaProvider extends BaseProvider {
  name = "ollama";
  supportsStreaming = false;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "OLLAMA_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (params.env.OLLAMA_ENABLED !== "true") {
      throw new AssistantError(
        "Missing OLLAMA_ENABLED",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  protected getEndpoint(params: ChatCompletionParameters): string {
    const ollamaUrl = params.env.OLLAMA_URL || "http://localhost:11434";
    return `${ollamaUrl}/api/chat`;
  }

  protected getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
    };
  }
}
