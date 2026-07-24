import z from "zod/v4";

const pashiFieldSchema = z
	.object({
		id: z.string().min(1),
		label: z.string().optional(),
		placeholder: z.string().optional(),
		required: z.boolean().optional(),
		type: z.string().optional(),
		options: z.array(z.string()).optional(),
		values: z.array(z.string()).optional(),
		description: z.string().optional(),
		defaultValue: z.string().optional(),
	})
	.passthrough();

const pashiInputSchema = z
	.object({
		kind: z.enum(["file", "text"]).optional(),
		mode: z.enum(["none", "text"]).optional(),
		label: z.string(),
		required: z.boolean(),
		fields: z.array(pashiFieldSchema).optional(),
	})
	.passthrough();

const pashiToolSchema = z
	.object({
		aliases: z.array(z.string()),
		api: z
			.object({
				fields: z.array(pashiFieldSchema).optional(),
				methods: z.array(z.string()).optional(),
				response: z.string().optional(),
			})
			.passthrough()
			.optional(),
		audience: z.string(),
		description: z.string(),
		display: z
			.object({
				actionLabel: z.string(),
				category: z.string(),
				examples: z.array(z.string()),
			})
			.passthrough(),
		endpoint: z.string().regex(/^\/api\/[a-z0-9][a-z0-9-]*$/),
		id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
		input: pashiInputSchema,
		label: z.string(),
		outputs: z.array(z.string()).optional(),
		result: z
			.object({
				kind: z.string(),
			})
			.passthrough()
			.optional(),
		runtime: z.string().optional(),
		status: z.string().optional(),
		toolType: z.enum(["converter", "generator"]),
	})
	.passthrough();

export const pashiInfoSchema = z
	.object({
		exportFormats: z.array(z.string()).optional(),
		features: z.record(z.string(), z.unknown()).optional(),
		name: z.string(),
		tools: z.array(pashiToolSchema),
	})
	.passthrough();

export type PashiField = z.infer<typeof pashiFieldSchema>;
export type PashiInfo = z.infer<typeof pashiInfoSchema>;
export type PashiTool = z.infer<typeof pashiToolSchema>;
export type PashiToolType = PashiTool["toolType"];

export interface PashiOperation {
	fields?: Record<string, string>;
	input?: string;
	toolId: string;
}

export interface PashiOperationResult {
	data: unknown;
	resultKind: string;
	toolId: string;
	toolType: PashiToolType;
}
