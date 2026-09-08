import z from "zod/v4";

export const realtimeProviderIds = [
  "openai",
  "google-ai-studio",
  "mistral",
  "elevenlabs",
  "cartesia",
] as const;
export const realtimeTransports = ["webrtc", "websocket"] as const;
export const realtimeSessionTypes = ["realtime", "translation", "transcription"] as const;
export const realtimeLiveSessionTypes = ["realtime", "transcription"] as const;
export const realtimeModalities = ["text", "audio", "image", "video"] as const;
export const realtimeOutputModalities = ["text", "audio"] as const;
export const realtimeTranscriptionDelays = ["minimal", "low", "medium", "high", "xhigh"] as const;

export const realtimeProviderIdSchema = z.enum(realtimeProviderIds);
export const realtimeTransportSchema = z.enum(realtimeTransports);
export const realtimeSessionTypeSchema = z.enum(realtimeSessionTypes);
export const realtimeLiveSessionTypeSchema = z.enum(realtimeLiveSessionTypes);
export const realtimeLiveModeSchema = z.enum(["native", "composed"]);
export const realtimeLiveModes = realtimeLiveModeSchema.options;
export const realtimeLiveProviderReadinessSchema = z.enum([
  "ready",
  "setup_required",
  "unavailable",
]);
export const realtimeModalitySchema = z.enum(realtimeModalities);
export const realtimeOutputModalitySchema = z.enum(realtimeOutputModalities);
export const realtimeTranscriptionDelaySchema = z.enum(realtimeTranscriptionDelays);

export const realtimeProxyGrantQuerySchema = z.object({
  grant: z.string().min(1),
  session_id: z.string().min(1),
  model: z.string().min(1),
  delay: realtimeTranscriptionDelaySchema.optional(),
  language: z.string().trim().min(1).optional(),
});

export const realtimeSessionResponseSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    type: z.string().optional(),
    max_session_seconds: z.number().optional(),
    provider: z.string().optional(),
    transport: z.enum(["webrtc", "websocket"]).optional(),
    protocol: z.string().optional(),
    url: z.string().url().optional(),
    model: z.string().optional(),
    audio: z
      .object({
        input: z
          .object({
            format: z
              .object({
                type: z.string(),
                rate: z.number().optional(),
              })
              .optional(),
            transcription: z
              .object({
                model: z.string(),
                language: z.string().optional(),
                delay: z.enum(["minimal", "low", "medium", "high", "xhigh"]).optional(),
              })
              .optional(),
            turn_detection: z.unknown().optional().nullable(),
          })
          .optional(),
        output: z
          .object({
            format: z
              .object({
                type: z.string(),
                rate: z.number().optional(),
              })
              .optional(),
            voice: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    modalities: z.array(z.string()).optional(),
    input_modalities: z.array(z.enum(["text", "audio", "image", "video"])).optional(),
    output_modalities: z.array(z.enum(["text", "audio"])).optional(),
    turn_detection: z
      .object({
        type: z.string(),
        threshold: z.number(),
        prefix_padding_ms: z.number(),
        silence_duration_ms: z.number(),
      })
      .optional(),
    input_audio_format: z.string().optional(),
    audio_format: z
      .object({
        encoding: z.string(),
        sample_rate: z.number(),
      })
      .optional(),
    input_audio_transcription: z
      .object({
        model: z.string(),
        language: z.string().optional(),
        language_code: z.string().optional(),
      })
      .optional(),
    translation: z
      .object({
        source_language: z.string().optional(),
        target_language: z.string().optional(),
      })
      .optional(),
    target_streaming_delay_ms: z.number().optional(),
    proxy_grant_expires_at: z.number().int().positive().optional(),
    client_secret: z
      .object({
        expires_at: z.number().optional(),
        value: z.string(),
      })
      .optional(),
    setup: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const realtimeSessionCreateSchema = z.object({
  model: z.string().optional(),
  type: realtimeSessionTypeSchema,
  provider: z.string().optional(),
  transport: realtimeTransportSchema.optional(),
  input_modalities: z.array(realtimeModalitySchema).optional(),
  output_modalities: z.array(realtimeOutputModalitySchema).optional(),
});

export const realtimePipelineStageSchema = z.object({
  provider: z.string(),
  model: z.string(),
});

export const realtimePipelineSpeechStageSchema = realtimePipelineStageSchema.extend({
  voice: z.string().optional(),
});

export const realtimePipelineLatencyProfileSchema = z.enum(["low", "balanced", "quality"]);

export const realtimePipelineSessionCreateSchema = z.object({
  input: realtimePipelineStageSchema,
  reasoning: realtimePipelineStageSchema,
  output: realtimePipelineSpeechStageSchema,
  latency_profile: realtimePipelineLatencyProfileSchema.optional(),
  language: z.string().optional(),
  delay: realtimeTranscriptionDelaySchema.optional(),
});

export const realtimePipelineSessionResponseSchema = z.object({
  id: z.string(),
  object: z.literal("realtime.pipeline.session"),
  type: z.literal("pipeline"),
  live_mode: z.literal("composed"),
  input: realtimePipelineStageSchema.extend({
    session: realtimeSessionResponseSchema,
  }),
  reasoning: realtimePipelineStageSchema,
  output: realtimePipelineSpeechStageSchema,
  latency_profile: realtimePipelineLatencyProfileSchema,
});

export const realtimeLiveProviderManifestItemSchema = z.object({
  id: realtimeProviderIdSchema,
  label: z.string(),
  shortLabel: z.string(),
  liveMode: realtimeLiveModeSchema,
  transport: realtimeTransportSchema,
  sessionType: realtimeLiveSessionTypeSchema,
  defaultDelay: realtimeTranscriptionDelaySchema.optional(),
  inputModalities: z.array(realtimeModalitySchema),
  outputModalities: z.array(realtimeOutputModalitySchema),
  description: z.string(),
  defaultModelId: z.string(),
  composeWith: z
    .object({
      reasoning: z.boolean(),
      speech: z.boolean(),
    })
    .optional(),
  supportsVideoInput: z.boolean().optional(),
});

export const realtimeLiveProviderDescriptorSchema = realtimeLiveProviderManifestItemSchema.extend({
  order: z.number().int().nonnegative(),
});

export const realtimeLiveProviderCatalogueItemSchema = realtimeLiveProviderDescriptorSchema.extend({
  available: z.boolean(),
  readiness: realtimeLiveProviderReadinessSchema,
  availabilityReason: z.string(),
});

export const realtimeLiveProviderCatalogueResponseSchema = z.object({
  providers: z.array(realtimeLiveProviderCatalogueItemSchema),
});

export type RealtimeProviderId = z.infer<typeof realtimeProviderIdSchema>;
export type RealtimeTransport = z.infer<typeof realtimeTransportSchema>;
export type RealtimeSessionType = z.infer<typeof realtimeSessionTypeSchema>;
export type RealtimeLiveSessionType = z.infer<typeof realtimeLiveSessionTypeSchema>;
export type RealtimeLiveMode = z.infer<typeof realtimeLiveModeSchema>;
export type RealtimeLiveProviderReadiness = z.infer<typeof realtimeLiveProviderReadinessSchema>;
export type RealtimeModality = z.infer<typeof realtimeModalitySchema>;
export type RealtimeOutputModality = z.infer<typeof realtimeOutputModalitySchema>;
export type RealtimeTranscriptionDelay = z.infer<typeof realtimeTranscriptionDelaySchema>;
export type RealtimeSessionResponse = z.infer<typeof realtimeSessionResponseSchema>;
export type RealtimePipelineSessionCreate = z.infer<typeof realtimePipelineSessionCreateSchema>;
export type RealtimePipelineSessionResponse = z.infer<typeof realtimePipelineSessionResponseSchema>;
export type RealtimeLiveProviderManifestItem = z.infer<
  typeof realtimeLiveProviderManifestItemSchema
>;
export type RealtimeLiveProviderDescriptor = z.infer<typeof realtimeLiveProviderDescriptorSchema>;
export type RealtimeLiveProviderCatalogueItem = z.infer<
  typeof realtimeLiveProviderCatalogueItemSchema
>;
export type RealtimeLiveProviderCatalogueResponse = z.infer<
  typeof realtimeLiveProviderCatalogueResponseSchema
>;
