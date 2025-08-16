import { gatewayId } from "~/constants/app";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { TranscriptionRequest, TranscriptionResponse } from "./base";
import { BaseTranscriptionProvider } from "./base";

export class WorkersTranscriptionProvider extends BaseTranscriptionProvider {
  name = "workers";

  async transcribe(
    request: TranscriptionRequest,
  ): Promise<TranscriptionResponse> {
    this.validateRequest(request);

    const { audio, env, user } = request;

    if (!env.AI) {
      throw new AssistantError("Missing AI binding", ErrorType.PARAMS_ERROR);
    }

    try {
      let arrayBuffer: ArrayBuffer;

      if (
        typeof audio === "string" &&
        (audio.startsWith("http://") || audio.startsWith("https://"))
      ) {
        const res = await fetch(audio);
        if (!res.ok) {
          throw new AssistantError(
            `Failed to fetch audio from URL: ${res.status} ${res.statusText}`,
            ErrorType.PARAMS_ERROR,
          );
        }
        arrayBuffer = await res.arrayBuffer();
      } else if (audio instanceof Blob) {
        arrayBuffer = await audio.arrayBuffer();
      } else {
        throw new AssistantError(
          "Audio must be a Blob or a URL string",
          ErrorType.PARAMS_ERROR,
        );
      }

      const response = await env.AI.run(
        "@cf/openai/whisper",
        {
          audio: [...new Uint8Array(arrayBuffer)],
        },
        {
          gateway: {
            id: gatewayId,
            skipCache: false,
            cacheTtl: 3360,
            metadata: {
              email: user?.email,
            },
          },
        },
      );

      if (!response.text) {
        throw new AssistantError("No response from the model");
      }

      return {
        text: response.text,
        data: response,
      };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        `Workers AI transcription error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ErrorType.EXTERNAL_API_ERROR,
      );
    }
  }
}
