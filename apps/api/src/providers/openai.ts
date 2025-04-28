import type { ChatCompletionParameters, IEnv, IUser } from "~/types";
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

  async createRealtimeSession(
    env: IEnv,
    user: IUser,
    type: string,
    body: Record<string, any>,
  ): Promise<any> {
    const model = body.model || "gpt-4o-realtime-preview";

    const endpoint =
      type === "transcription"
        ? "realtime/transcription_sessions"
        : "realtime/sessions";

    const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
      method: "POST",
      headers: await this.getHeaders({
        env,
        user,
        model,
        message: "",
      }),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new AssistantError(
        "Failed to create realtime session",
        ErrorType.EXTERNAL_API_ERROR,
      );
    }

    return response.json();
  }
}
