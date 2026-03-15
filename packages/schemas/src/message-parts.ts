import z from "zod/v4";

const partBaseSchema = z.object({
	id: z.string().optional(),
	timestamp: z.number().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const textPartSchema = partBaseSchema.extend({
	type: z.literal("text"),
	text: z.string(),
});

export const toolUsePartSchema = partBaseSchema.extend({
	type: z.literal("tool_use"),
	name: z.string(),
	toolCallId: z.string().optional(),
	input: z
		.union([
			z.string(),
			z.array(z.unknown()),
			z.record(z.string(), z.unknown()),
		])
		.optional(),
});

export const toolResultPartSchema = partBaseSchema.extend({
	type: z.literal("tool_result"),
	name: z.string().optional(),
	toolCallId: z.string().optional(),
	status: z.string().optional(),
	content: z
		.union([
			z.string(),
			z.array(z.unknown()),
			z.record(z.string(), z.unknown()),
		])
		.optional(),
	data: z.unknown().optional(),
});

export const reasoningPartSchema = partBaseSchema.extend({
	type: z.literal("reasoning"),
	text: z.string(),
	signature: z.string().optional(),
	collapsed: z.boolean().optional(),
});

export const snapshotPartSchema = partBaseSchema.extend({
	type: z.literal("snapshot"),
	summary: z.string(),
	title: z.string().optional(),
});

export const filePartSchema = partBaseSchema.extend({
	type: z.literal("file"),
	name: z.string().optional(),
	url: z.string().optional(),
	mimeType: z.string().optional(),
	sizeBytes: z.number().int().nonnegative().optional(),
});

export const messagePartSchema = z.discriminatedUnion("type", [
	textPartSchema,
	toolUsePartSchema,
	toolResultPartSchema,
	reasoningPartSchema,
	snapshotPartSchema,
	filePartSchema,
]);

export const messagePartsSchema = z.array(messagePartSchema);

export type MessagePart = z.infer<typeof messagePartSchema>;
