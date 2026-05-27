import z from "zod/v4";

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
	type: z.enum(["realtime", "translation", "transcription"]),
	provider: z.string().optional(),
	transport: z.enum(["webrtc", "websocket"]).optional(),
	input_modalities: z.array(z.enum(["text", "audio", "image", "video"])).optional(),
	output_modalities: z.array(z.enum(["text", "audio"])).optional(),
});
