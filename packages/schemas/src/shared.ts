import z from "zod/v4";
import { normaliseCompactionStatusMessage } from "./compaction-status";
import { messagePartsSchema } from "./message-parts";

export const messageRoleSchema = z.enum([
	"user",
	"assistant",
	"system",
	"tool",
	"developer",
	"compaction",
]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const messageSchema = z
	.object({
		role: messageRoleSchema,
		name: z.string().optional(),
		tool_calls: z
			.array(
				z.object({
					id: z.string(),
					type: z.literal("function").optional(),
					index: z.number().optional(),
					function: z.object({
						name: z.string(),
						arguments: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
					}),
				}),
			)
			.optional(),
		parts: messagePartsSchema.optional(),
		content: z
			.union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())])
			.nullable()
			.optional(),
		status: z.string().optional(),
		data: z.record(z.string(), z.any()).optional(),
		completion_id: z.string().optional(),
		created: z.number().optional(),
		model: z.string().optional(),
		provider: z.string().optional(),
		log_id: z.string().optional(),
		reasoning: z
			.object({
				collapsed: z.boolean().optional(),
				content: z.string(),
			})
			.optional(),
		citations: z.array(z.string()).nullable().optional(),
		app: z.string().optional(),
		mode: z.string().optional(),
		id: z.string().optional(),
		parent_message_id: z.string().optional(),
		tool_call_id: z.string().optional(),
		tool_call_arguments: z.any().optional(),
		timestamp: z.number().optional(),
		platform: z.string().optional(),
		usage: z.record(z.string(), z.any()).optional(),
	})
	.superRefine((message, ctx) => {
		const hasContent = message.content !== undefined && message.content !== null;
		const hasParts = Array.isArray(message.parts) && message.parts.length > 0;
		const hasToolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;

		if (!hasContent && !hasParts && !hasToolCalls) {
			ctx.addIssue({
				code: "custom",
				path: ["content"],
				message: "Message must include content, parts, or tool_calls",
			});
		}

		if (message.role === "compaction" && !normaliseCompactionStatusMessage(message)) {
			ctx.addIssue({
				code: "custom",
				path: ["parts"],
				message: "Compaction messages must include a valid compaction part",
			});
		}
	});

export const apiResponseSchema = z.object({
	response: z.object({
		status: z.enum(["success", "error"]),
		name: z.string().optional(),
		content: z.string().nullable().optional(),
		data: z.any().optional(),
	}),
});

export const errorResponseSchema = z.object({
	error: z.string(),
	type: z.string(),
	statusCode: z.number().optional(),
});

export const successResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
});

export const statusResponseSchema = z.object({
	status: z.string().meta({ example: "ok" }),
	timestamp: z.string().meta({ example: "2021-01-01T00:00:00.000Z" }),
	version: z.string().meta({ example: "1.0.0" }),
	environment: z.string().meta({ example: "development" }),
	responseTime: z.number().meta({ example: 100 }),
	checks: z.record(z.string(), z.any()).meta({ example: { database: { status: "healthy" } } }),
});

export const metricsParamsSchema = z.object({
	status: z.string().optional(),
	type: z.string().optional(),
	limit: z.string().optional(),
	interval: z.string().optional(),
	timeframe: z.string().optional(),
});
