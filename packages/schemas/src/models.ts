import z from "zod/v4";

const modalitySchema = z.enum([
	"text",
	"image",
	"audio",
	"video",
	"pdf",
	"document",
	"embedding",
	"speech",
]);

export const modelSchema = z.object({
	id: z.string(),
	name: z.string(),
	provider: z.string(),
	description: z.string().optional(),
	capabilities: z.array(z.string()).optional(),
	context_length: z.number().optional(),
	pricing: z
		.object({
			prompt: z.number().optional(),
			completion: z.number().optional(),
		})
		.optional(),
	modalities: z
		.object({
			input: z.array(modalitySchema),
			output: z.array(modalitySchema).optional(),
		})
		.optional(),
});

export const modelsResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	data: z.record(z.string(), modelSchema),
});

export const modelResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	data: modelSchema,
});

export const capabilitiesResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	data: z.array(z.string()),
});

export const capabilityParamsSchema = z.object({ capability: z.string() });
export const modalityParamsSchema = z.object({ modality: modalitySchema });
export const modelParamsSchema = z.object({ id: z.string() });
