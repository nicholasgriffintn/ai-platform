import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { formatProviderError } from "../../../utils/errors.js";
import { greenPtRequest, resolveGreenPtApiKey } from "../../../utils/greenpt.js";
import { BaseTranscriptionProvider } from "../base.js";
import type { TranscriptionRequest, TranscriptionResult } from "../index.js";

export const GREENPT_TRANSCRIPTION_MODELS = ["green-s", "green-s-pro"];
const DEFAULT_TRANSCRIPTION_MODEL = "green-s";
const DEFAULT_LANGUAGE = "en";

export interface GreenPtTranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: number;
  language?: string;
}

export interface GreenPtTranscriptionResponse {
  metadata?: {
    request_id?: string;
    duration?: number;
    channels?: number;
    created?: string;
  };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        languages?: string[];
        words?: GreenPtTranscriptionWord[];
      }>;
    }>;
  };
}

export function extractGreenPtTranscript(response: GreenPtTranscriptionResponse): string {
  return (response.results?.channels ?? [])
    .map((channel) => channel.alternatives?.[0]?.transcript?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

export class GreenPtTranscriptionProvider extends BaseTranscriptionProvider {
  name = "greenpt";

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    this.validateRequest(request);

    const { audio, env, language, timestamps = false, user } = request;
    const model = request.model ?? DEFAULT_TRANSCRIPTION_MODEL;

    if (!GREENPT_TRANSCRIPTION_MODELS.includes(model)) {
      throw new AssistantError(
        `Model ${model} is not supported by the GreenPT transcription provider`,
        ErrorType.PARAMS_ERROR,
      );
    }

    try {
      const apiKey = await resolveGreenPtApiKey(this.runtime.host, { env, userId: user?.id });
      const params = new URLSearchParams({
        model,
        language: language ?? DEFAULT_LANGUAGE,
        punctuate: "true",
      });

      if (timestamps) {
        params.set("diarize_model", "latest");
      }

      const result = await greenPtRequest<GreenPtTranscriptionResponse>({
        apiKey,
        authScheme: "Token",
        path: `/listen?${params.toString()}`,
        body: audio.file,
        contentType: audio.file.type || "application/octet-stream",
        label: "GreenPT transcription",
      });
      const text = extractGreenPtTranscript(result);

      if (!text) {
        throw new AssistantError(
          "No transcription text returned from GreenPT",
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      return {
        text,
        data: result,
        metadata: {
          model,
          requestId: result.metadata?.request_id,
          duration: result.metadata?.duration,
        },
      };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        await formatProviderError(error, "GreenPT transcription error"),
        ErrorType.EXTERNAL_API_ERROR,
      );
    }
  }
}
