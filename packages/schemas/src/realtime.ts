import z from "zod/v4";

export const realtimeSessionResponseSchema = z
	.object({
		id: z.string(),
		object: z.string(),
		type: z.string().optional(),
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
			})
			.optional(),
		modalities: z.array(z.string()).optional(),
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
				expires_at: z.number(),
				value: z.string(),
			})
			.optional(),
	})
	.passthrough();

export const realtimeSessionCreateSchema = z.object({
	model: z.string().optional(),
	type: z.enum(["realtime", "translation", "transcription"]),
});
