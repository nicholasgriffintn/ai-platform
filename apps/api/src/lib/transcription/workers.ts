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
      if (!(audio instanceof Blob)) {
        throw new AssistantError(
          "Audio must be a Blob",
          ErrorType.PARAMS_ERROR,
        );
      }

      const arrayBuffer = await audio.arrayBuffer();

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
