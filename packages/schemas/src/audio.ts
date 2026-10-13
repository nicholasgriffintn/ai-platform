import z from "zod/v4";

export const transcribeQuerySchema = z.object({
  provider: z.enum(["workers", "mistral", "replicate", "greenpt"]).optional(),
  timestamps: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const transcribeFormSchema = z.object({
  audio: z.custom<File>(
    (value) => typeof File !== "undefined" && value instanceof File,
    "An audio file is required",
  ),
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

export type TranscriptionSegment = z.infer<typeof transcriptionSegmentSchema>;
export type TranscriptionWord = z.infer<typeof transcriptionWordSchema>;
export type TranscriptionResult = z.infer<typeof transcriptionResultSchema>;
export type TranscriptionResponse = z.infer<typeof transcriptionResponseSchema>;

export const textToSpeechSchema = z.object({
  input: z.string().meta({
    description:
      "The text to generate audio for. Long text may be truncated to the selected provider limit.",
  }),
  provider: z.enum(["polly", "cartesia", "elevenlabs", "melotts", "mistral"]).optional(),
  model: z.string().optional().meta({
    description: "The speech model or voice to use with the selected provider.",
  }),
  lang: z.string().optional(),
  voice_id: z.string().optional().meta({
    description: "Saved voice identifier for providers that support reusable voices.",
  }),
  ref_audio: z.string().optional().meta({
    description: "Base64-encoded reference audio for providers that support one-off voice cloning.",
  }),
  response_format: z.enum(["mp3", "wav", "pcm", "flac", "opus"]).optional(),
  store: z.boolean().optional().meta({
    description: "Whether to store the generated audio artifact.",
  }),
});

export const CAPTION_VIDEO_MAX_BYTES = 25 * 1024 * 1024;
