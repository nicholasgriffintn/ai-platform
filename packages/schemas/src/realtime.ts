import z from "zod/v4";

export const realtimeSessionResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  modalities: z.array(z.string()),
  turn_detection: z.object({
    type: z.string(),
    threshold: z.number(),
    prefix_padding_ms: z.number(),
    silence_duration_ms: z.number(),
  }),
  input_audio_format: z.string(),
  input_audio_transcription: z.object({
    model: z.string(),
    language: z.string(),
    language_code: z.string(),
  }),
  client_secret: z.object({
    expires_at: z.number(),
    value: z.string(),
  }),
});

export const realtimeSessionCreateSchema = z.object({
  model: z.string().optional(),
  type: z.enum(["transcription"]),
});
