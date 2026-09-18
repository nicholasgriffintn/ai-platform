import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveAiGatewayId } from "../../../gateway.js";
import { BaseTranscriptionProvider } from "../base.js";
import type { TranscriptionRequest, TranscriptionResult } from "../index.js";

async function getAudioForProvider(model: string, file: Blob) {
  if (model === "@cf/deepgram/nova-3") {
    return file.stream();
  }

  if (model === "@cf/openai/whisper-large-v3-turbo") {
    throw new AssistantError("Not implemented", ErrorType.CONFIGURATION_ERROR);
  } else {
    const audioData = await file.arrayBuffer();

    return [...new Uint8Array(audioData)];
  }
}

function readTranscriptText(response: unknown): string | null {
  if (!isRecord(response) || typeof response.text !== "string") {
    return null;
  }

  return response.text;
}

export class WorkersTranscriptionProvider extends BaseTranscriptionProvider {
  name = "workers";

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    this.validateRequest(request);

    const { audio, env, user } = request;

    if (!env.AI) {
      throw new AssistantError("Missing AI binding", ErrorType.PARAMS_ERROR);
    }

    const { model: modelToUse, provider: providerToUse } =
      await this.runtime.host.models.getAuxiliarySpeechModel(env, user);

    if (!modelToUse || !providerToUse) {
      throw new AssistantError("Missing model or provider", ErrorType.PARAMS_ERROR);
    }

    if (providerToUse !== "workers-ai") {
      throw new AssistantError("This provider is only for Workers AI", ErrorType.PARAMS_ERROR);
    }

    try {
      const body: Record<string, any> = {};

      if (audio.kind === "file") {
        const MAX_SIZE = 25 * 1024 * 1024;

        if (audio.file.size > MAX_SIZE) {
          throw new AssistantError(
            `File too large for Workers AI (${Math.round(audio.file.size / 1024 / 1024)}MB > 25MB). Use a different transcription provider for larger files.`,
            ErrorType.PARAMS_ERROR,
          );
        }

        body.audio = await getAudioForProvider(modelToUse, audio.file);
      } else {
        throw new AssistantError(
          "Workers AI does not accept remote transcription URLs",
          ErrorType.PARAMS_ERROR,
        );
      }

      const response = await env.AI.run(modelToUse, body, {
        gateway: {
          id: resolveAiGatewayId(),
          skipCache: true,
        },
      });

      const text = readTranscriptText(response);

      if (!text) {
        throw new AssistantError("No response from the model");
      }

      return {
        text,
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
