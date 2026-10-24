import z from "zod/v4";

import { queryBooleanSchema } from "./platform/query.js";
import { speechProviderSchema } from "./speech-voices.js";

export const transcribeQuerySchema = z.object({
  provider: z.enum(["workers", "mistral", "replicate", "greenpt"]).optional(),
  timestamps: queryBooleanSchema.optional(),
});

export const transcribeFormSchema = z.object({
  audio: z.custom<File>(
    (value) => typeof File !== "undefined" && value instanceof File,
    "An audio file is required",
  ),
});

export const MAX_TRANSCRIPTION_VOCABULARY_TERMS = 100;
export const transcriptionVocabularyTermSchema = z.string().trim().min(1).max(200);
export const transcriptionVocabularySchema = z
  .array(transcriptionVocabularyTermSchema)
  .max(MAX_TRANSCRIPTION_VOCABULARY_TERMS);

export const speechExpressivenessSchema = z.number().min(1).max(5);

export const MAX_SAVED_SPEECH_VOICES = 20;
export const savedSpeechVoiceSchema = z.object({
  id: z.string().trim().min(1).max(128),
  provider: z.literal("mistral"),
  name: z.string().trim().min(1).max(80),
  created_at: z.string(),
});
export const savedSpeechVoicesSchema = z.array(savedSpeechVoiceSchema).max(MAX_SAVED_SPEECH_VOICES);

export const MAX_SPEECH_VOICE_SAMPLE_BYTES = 20 * 1024 * 1024;
export const SPEECH_VOICE_SAMPLE_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav"] as const;

export const createSpeechVoiceFormSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sample: z.custom<File>(
    (value) =>
      typeof File !== "undefined" &&
      value instanceof File &&
      value.size <= MAX_SPEECH_VOICE_SAMPLE_BYTES &&
      SPEECH_VOICE_SAMPLE_TYPES.some((type) => type === value.type),
    "An MP3 or WAV voice sample up to 20 MB is required",
  ),
  consent: z.literal("true", { error: "Confirm the voice is yours or you have permission" }),
});

export const speechVoiceListResponseSchema = z.object({
  voices: savedSpeechVoicesSchema,
});

export const speechVoiceResponseSchema = z.object({
  voice: savedSpeechVoiceSchema,
});

export const transcriptionSegmentSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string(),
  speaker: z.string().optional(),
});

export const transcriptionWordSchema = z.object({
  word: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  speaker: z.string().optional(),
});

export const transcriptionResultSchema = z.object({
  status: z.literal("success"),
  content: z.string(),
  segments: z.array(transcriptionSegmentSchema).optional(),
  words: z.array(transcriptionWordSchema).optional(),
});

export const transcriptionResponseSchema = z.object({
  response: transcriptionResultSchema,
});

export type SavedSpeechVoice = z.infer<typeof savedSpeechVoiceSchema>;
export type TranscriptionSegment = z.infer<typeof transcriptionSegmentSchema>;
export type TranscriptionWord = z.infer<typeof transcriptionWordSchema>;
export type TranscriptionResult = z.infer<typeof transcriptionResultSchema>;
export type TranscriptionResponse = z.infer<typeof transcriptionResponseSchema>;

export const textToSpeechSchema = z.object({
  input: z.string().meta({
    description:
      "The text to generate audio for. Long text may be truncated to the selected provider limit.",
  }),
  provider: speechProviderSchema.optional().meta({
    description: "The speech provider. Leave it out to use the best voice your account can reach.",
  }),
  model: z.string().optional().meta({
    description: "A speech model ID from the model catalogue, such as eleven_v4.",
  }),
  lang: z.string().optional(),
  voice_id: z.string().optional().meta({
    description: "A preset or saved voice for the selected provider.",
  }),
  ref_audio: z.string().optional().meta({
    description: "Base64-encoded reference audio for providers that support one-off voice cloning.",
  }),
  response_format: z.enum(["mp3", "wav", "pcm", "flac", "opus"]).optional(),
  expressiveness: speechExpressivenessSchema.optional().meta({
    description:
      "How strongly the voice performs the text, from 1 to 5, for providers that support it. Higher values trade voice similarity for delivery.",
  }),
  store: z.boolean().optional().meta({
    description: "Whether to store the generated audio artifact.",
  }),
});
