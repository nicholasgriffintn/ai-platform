import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { BaseProvider } from "./base";

const LMSTUDIO_DEFAULT_BASE_URL = "http://127.0.0.1:1234";

export class LMStudioProvider extends BaseProvider {
  name = "lmstudio";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "LMSTUDIO_API_KEY";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (params.env.LMSTUDIO_ENABLED !== "true") {
      throw new AssistantError("Missing LMSTUDIO_ENABLED", ErrorType.CONFIGURATION_ERROR);
    }
  }

  protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
    const baseUrl = params.env.LMSTUDIO_URL || LMSTUDIO_DEFAULT_BASE_URL;

    return `${baseUrl}/v1/chat/completions`;
  }

  protected getHeaders(params: ChatCompletionParameters): Record<string, string> {
    const apiKey = params.env.LMSTUDIO_API_KEY;

    return {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    };
  }
}
