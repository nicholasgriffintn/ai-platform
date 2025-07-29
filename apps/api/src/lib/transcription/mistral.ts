import { gatewayId } from "~/constants/app";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { TranscriptionRequest, TranscriptionResponse } from "./base";
import { BaseTranscriptionProvider } from "./base";

export class MistralTranscriptionProvider extends BaseTranscriptionProvider {
  name = "mistral";

  protected getProviderKeyName(): string {
    return "MISTRAL_API_KEY";
  }

  async transcribe(
    request: TranscriptionRequest,
  ): Promise<TranscriptionResponse> {
    this.validateRequest(request);

    const { audio, env, timestamps = false } = request;

    if (!env.MISTRAL_API_KEY || !env.AI_GATEWAY_TOKEN || !env.ACCOUNT_ID) {
      throw new AssistantError(
        "Missing MISTRAL_API_KEY, AI_GATEWAY_TOKEN, or ACCOUNT_ID",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    try {
      const formData = new FormData();

      if (
        typeof audio === "string" &&
        (audio.startsWith("http://") || audio.startsWith("https://"))
      ) {
        formData.append("file_url", audio);
      } else {
        if (!(audio instanceof Blob)) {
          throw new AssistantError(
            "Audio must be a Blob or a URL string",
            ErrorType.PARAMS_ERROR,
          );
        }

        formData.append("file", audio, "audio.wav");
      }

      formData.append("model", "voxtral-mini-2507");
      formData.append("language", "en");

      if (timestamps) {
        formData.append("timestamp_granularities", "segment");
      }

      const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${gatewayId}/mistral/v1/audio/transcriptions`;

      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "cf-aig-authorization": env.AI_GATEWAY_TOKEN,
          Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AssistantError(
          `Mistral transcription failed: ${response.status} ${errorText}`,
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      const result = (await response.json()) as { text?: string };

      if (!result.text) {
        throw new AssistantError(
          "No transcription text returned from Mistral",
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      return {
        text: result.text,
        data: result,
      };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        `Mistral transcription error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ErrorType.EXTERNAL_API_ERROR,
      );
    }
  }
}
