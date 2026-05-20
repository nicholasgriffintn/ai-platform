import z from "zod/v4";

export const transcribeQuerySchema = z.object({
	provider: z.enum(["workers", "mistral", "replicate"]).optional(),
	timestamps: z.coerce.boolean().optional(),
});

export const transcribeFormSchema = z.object({
	audio: z.any().meta({
		description:
			"The audio file to transcribe. Can be a File, Blob, or a URL string. If a URL, it must start with http:// or https://.",
	}),
});

export const textToSpeechSchema = z.object({
	input: z.string().meta({
		description: "The text to generate audio for. The maximum length is 4096 characters.",
	}),
	provider: z.enum(["polly", "cartesia", "elevenlabs", "melotts"]).optional(),
	model: z.string().optional().meta({
		description: "The speech model or voice to use with the selected provider.",
	}),
	lang: z.string().optional(),
	store: z.boolean().optional().meta({
		description: "Whether to store the generated audio artifact.",
	}),
});
