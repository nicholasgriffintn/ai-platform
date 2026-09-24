import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { formatProviderError } from "../../../utils/errors.js";
import { greenPtRequest, resolveGreenPtApiKey } from "../../../utils/greenpt.js";
import { BaseTranscriptionProvider } from "../base.js";
import type { TranscriptionRequest, TranscriptionResult } from "../index.js";

export const GREENPT_TRANSCRIPTION_MODELS = ["green-s", "green-s-pro"] as const;
const DEFAULT_TRANSCRIPTION_MODEL = "green-s";
const DEFAULT_LANGUAGE = "en";

const greenPtTranscriptionWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number().optional(),
  speaker: z.number().optional(),
  language: z.string().optional(),
});

const greenPtTranscriptionResponseSchema = z.object({
  metadata: z
    .object({
      request_id: z.string().optional(),
      duration: z.number().optional(),
      channels: z.number().optional(),
      created: z.string().optional(),
    })
    .optional(),
  results: z
    .object({
      channels: z
        .array(
          z.object({
            alternatives: z
              .array(
                z.object({
                  transcript: z.string().optional(),
                  confidence: z.number().optional(),
                  languages: z.array(z.string()).optional(),
                  words: z.array(greenPtTranscriptionWordSchema).optional(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type GreenPtTranscriptionWord = z.infer<typeof greenPtTranscriptionWordSchema>;
export type GreenPtTranscriptionResponse = z.infer<typeof greenPtTranscriptionResponseSchema>;

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

    if (!GREENPT_TRANSCRIPTION_MODELS.some((candidate) => candidate === model)) {
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

      const response = await greenPtRequest({
        apiKey,
        authScheme: "Token",
        path: `/listen?${params.toString()}`,
        body: audio.file,
        contentType: audio.file.type || "application/octet-stream",
        label: "GreenPT transcription",
      });
      const parsed = greenPtTranscriptionResponseSchema.safeParse(response);

      if (!parsed.success) {
        throw new AssistantError(
          "GreenPT returned an unexpected transcription payload",
          ErrorType.PROVIDER_ERROR,
          502,
        );
      }

      const result = parsed.data;
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
