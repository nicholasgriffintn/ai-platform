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
export const realtimeModalitySchema = z.enum(realtimeModalities);
export const realtimeOutputModalitySchema = z.enum(realtimeOutputModalities);
export const realtimeTranscriptionDelaySchema = z.enum(realtimeTranscriptionDelays);

export const realtimeSessionResponseSchema = z
	.object({
		id: z.string(),
		object: z.string(),
		type: z.string().optional(),
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

export const realtimeLiveProviderManifestItemSchema = z.object({
	id: realtimeProviderIdSchema,
	label: z.string(),
	shortLabel: z.string(),
	transport: realtimeTransportSchema,
	sessionType: realtimeLiveSessionTypeSchema,
	defaultDelay: realtimeTranscriptionDelaySchema.optional(),
	inputModalities: z.array(realtimeModalitySchema),
	outputModalities: z.array(realtimeOutputModalitySchema),
	description: z.string(),
	defaultModelId: z.string(),
	supportsVideoInput: z.boolean().optional(),
});

export const realtimeLiveProviderManifestResponseSchema = z.object({
	providers: z.array(realtimeLiveProviderManifestItemSchema),
});

export type RealtimeProviderId = z.infer<typeof realtimeProviderIdSchema>;
export type RealtimeTransport = z.infer<typeof realtimeTransportSchema>;
export type RealtimeSessionType = z.infer<typeof realtimeSessionTypeSchema>;
export type RealtimeLiveSessionType = z.infer<typeof realtimeLiveSessionTypeSchema>;
export type RealtimeModality = z.infer<typeof realtimeModalitySchema>;
export type RealtimeOutputModality = z.infer<typeof realtimeOutputModalitySchema>;
export type RealtimeTranscriptionDelay = z.infer<typeof realtimeTranscriptionDelaySchema>;
export type RealtimeLiveProviderManifestItem = z.infer<
	typeof realtimeLiveProviderManifestItemSchema
>;

export const REALTIME_LIVE_PROVIDER_MANIFEST: RealtimeLiveProviderManifestItem[] = [
	{
		id: "openai",
		label: "OpenAI Realtime",
		shortLabel: "OpenAI",
		transport: "webrtc",
		sessionType: "realtime",
		inputModalities: ["audio"],
		outputModalities: ["audio"],
		description: "WebRTC voice agent",
		defaultModelId: "gpt-realtime-2",
	},
	{
		id: "google-ai-studio",
		label: "Gemini Live",
		shortLabel: "Gemini",
		transport: "websocket",
		sessionType: "realtime",
		inputModalities: ["audio", "video"],
		outputModalities: ["audio"],
		description: "WebSocket voice and vision",
		defaultModelId: "gemini-3.1-flash-live-preview",
		supportsVideoInput: true,
	},
	{
		id: "mistral",
		label: "Mistral Realtime",
		shortLabel: "Mistral",
		transport: "websocket",
		sessionType: "transcription",
		defaultDelay: "low",
		inputModalities: ["audio"],
		outputModalities: ["text"],
		description: "Streaming speech-to-text",
		defaultModelId: "voxtral-mini-transcribe-realtime",
	},
	{
		id: "elevenlabs",
		label: "ElevenLabs Scribe Realtime",
		shortLabel: "ElevenLabs",
		transport: "websocket",
		sessionType: "transcription",
		defaultDelay: "minimal",
		inputModalities: ["audio"],
		outputModalities: ["text"],
		description: "Scribe realtime speech-to-text",
		defaultModelId: "scribe_v2_realtime",
	},
	{
		id: "cartesia",
		label: "Cartesia Ink Realtime",
		shortLabel: "Cartesia",
		transport: "websocket",
		sessionType: "transcription",
		defaultDelay: "low",
		inputModalities: ["audio"],
		outputModalities: ["text"],
		description: "Ink streaming speech-to-text",
		defaultModelId: "ink-whisper",
	},
];

export const DEFAULT_REALTIME_LIVE_PROVIDER_ID = REALTIME_LIVE_PROVIDER_MANIFEST[0].id;

export function getRealtimeLiveProviderManifestItem(
	providerId: RealtimeProviderId,
): RealtimeLiveProviderManifestItem {
	const provider = REALTIME_LIVE_PROVIDER_MANIFEST.find(({ id }) => id === providerId);

	if (!provider) {
		throw new Error(`Unknown realtime live provider: ${providerId}`);
	}

	return provider;
}
