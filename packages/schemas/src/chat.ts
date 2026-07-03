import z from "zod/v4";

import { normaliseCompactionStatusMessage } from "./compaction-status";
import { messagePartsSchema } from "./message-parts";
import { messageRoleSchema, messageSchema } from "./shared";

export {
	chatCompletionMessageSchema,
	chatCompletionToolSchema,
	chatHostedToolSettingsSchema,
	chatMessageContentPartSchema,
	chatRagOptionsSchema,
	chatRequestOptionsSchema,
	chatResponseFormatSchema,
	chatToolChoiceSchema,
	modelRouterModeSchema,
	partialChatCompletionsJsonSchema,
	createChatCompletionsResponseSchema,
	createChatCompletionsJsonSchema,
	parseChatRequestOptions,
	readRecipeChatRequestOptions,
} from "./chat-completions";
export type {
	ChatCompletionRequestBody,
	ChatCompletionResponseBody,
	ChatHostedToolSettings,
	ChatRequestOptions,
	ModelRouterMode,
	ParsedChatCompletionRequestBody,
} from "./chat-completions";

export const chatCompletionResponseSchema = z.object({
	id: z.string(),
	object: z.string(),
	created: z.number(),
	model: z.string(),
	choices: z.array(
		z.object({
			index: z.number(),
			message: messageSchema,
			finish_reason: z.string().nullable(),
		}),
	),
	usage: z
		.object({
			prompt_tokens: z.number(),
			completion_tokens: z.number(),
			total_tokens: z.number(),
		})
		.optional(),
	log_id: z.string().optional(),
});

export const countTokensJsonSchema = z.object({
	model: z.string().meta({
		description: "The model to use for token counting.",
	}),
	provider: z.string().optional().meta({
		description: "The provider to use when the model name is shared by multiple providers.",
	}),
	messages: z.array(z.any()).meta({
		description: "The messages to count tokens for.",
	}),
	system_prompt: z.string().optional().meta({
		description: "The system prompt to include in token count.",
	}),
});

export const countTokensResponseSchema = z.object({
	inputTokens: z.number().meta({
		description: "The number of input tokens.",
	}),
	model: z.string().meta({
		description: "The model used for token counting.",
	}),
});

export const getChatCompletionParamsSchema = z.object({
	completion_id: z.string().meta({
		description: "The ID of the chat completion to retrieve.",
	}),
});

export const generateChatCompletionTitleParamsSchema = z.object({
	completion_id: z.string().meta({
		description: "The ID of the chat completion to retrieve.",
	}),
});

export const generateChatCompletionTitleJsonSchema = z.object({
	messages: z
		.array(
			z.object({
				role: messageRoleSchema,
				content: z.union([z.string(), z.array(z.any())]),
				parts: messagePartsSchema.optional(),
			}),
		)
		.optional(),
	store: z.boolean().optional(),
});

export const updateChatCompletionParamsSchema = z.object({
	completion_id: z.string().meta({
		description: "The ID of the chat completion to retrieve.",
	}),
});

export const updateChatCompletionJsonSchema = z
	.object({
		title: z.string().optional(),
		archived: z.boolean().optional(),
		messages: z.array(messageSchema).min(1).optional(),
		parent_conversation_id: z.string().optional(),
		parent_message_id: z.string().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		error: "At least one field must be provided for update",
	});

export const deleteChatCompletionParamsSchema = z.object({
	completion_id: z.string().meta({
		description: "The ID of the chat completion to delete.",
	}),
});

export const checkChatCompletionParamsSchema = z.object({
	completion_id: z.string().min(1, "completion_id is required").meta({
		description: "The ID of the chat completion to retrieve.",
	}),
});

export const checkChatCompletionJsonSchema = z.object({
	role: z.enum(["user", "assistant", "tool"]).optional().meta({
		description: "The role of the message author to check.",
	}),
});

export const submitChatCompletionFeedbackParamsSchema = z.object({
	completion_id: z.string().min(1, "completion_id is required").meta({
		description: "The ID of the chat completion to retrieve.",
	}),
});

export const submitChatCompletionFeedbackJsonSchema = z.object({
	log_id: z.string().min(1, "log_id is required"),
	feedback: z.number(),
});

export const shareConversationParamsSchema = z.object({
	completion_id: z.string().min(1),
});

export const unshareConversationParamsSchema = z.object({
	completion_id: z.string().min(1),
});

export const getSharedConversationParamsSchema = z.object({
	share_id: z.string().min(1),
});

export const getChatCompletionResponseSchema = z.object({
	id: z.string(),
	title: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
	model: z.string(),
	is_archived: z.boolean(),
	user_id: z.string().nullable(),
	share_id: z.string().nullable(),
	settings: z.record(z.string(), z.any()).optional(),
});

const storedChatMessageResponseSchema = z
	.object({
		id: z.string().optional(),
		role: messageRoleSchema,
		name: z.string().nullable().optional(),
		tool_calls: z.array(z.unknown()).nullable().optional(),
		parts: messagePartsSchema.nullable().optional(),
		content: z
			.union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())])
			.nullable()
			.optional(),
		status: z.string().nullable().optional(),
		data: z.record(z.string(), z.any()).nullable().optional(),
		completion_id: z.string().nullable().optional(),
		created: z.number().optional(),
		model: z.string().nullable().optional(),
		provider: z.string().nullable().optional(),
		log_id: z.string().nullable().optional(),
		reasoning: z
			.object({
				collapsed: z.boolean().optional(),
				content: z.string(),
			})
			.nullable()
			.optional(),
		citations: z.array(z.string()).nullable().optional(),
		app: z.string().nullable().optional(),
		mode: z.string().nullable().optional(),
		parent_message_id: z.string().nullable().optional(),
		tool_call_id: z.string().nullable().optional(),
		tool_call_arguments: z.any().optional(),
		timestamp: z.number().optional(),
		platform: z.string().nullable().optional(),
		usage: z.record(z.string(), z.any()).nullable().optional(),
	})
	.passthrough()
	.superRefine((message, ctx) => {
		const hasContent = message.content !== undefined && message.content !== null;
		const hasParts = Array.isArray(message.parts) && message.parts.length > 0;
		const hasToolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;

		if (!hasContent && !hasParts && !hasToolCalls) {
			ctx.addIssue({
				code: "custom",
				path: ["content"],
				message: "Stored message responses must include content, parts, or tool_calls",
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

export const getChatCompletionMessagesResponseSchema = z.object({
	messages: z.array(storedChatMessageResponseSchema),
	conversation_id: z.string(),
});

export const compactChatCompletionResponseSchema = z
	.object({
		compacted: z.boolean(),
		conversation: z
			.object({
				messages: z.array(storedChatMessageResponseSchema),
			})
			.passthrough(),
	})
	.superRefine((response, ctx) => {
		if (
			response.compacted &&
			!response.conversation.messages.some((message) => normaliseCompactionStatusMessage(message))
		) {
			ctx.addIssue({
				code: "custom",
				path: ["conversation", "messages"],
				message: "Compacted responses must include a visible compaction message",
			});
		}
	});

export type CompactChatCompletionResponse = z.infer<typeof compactChatCompletionResponseSchema>;

export const getMessageResponseSchema = storedChatMessageResponseSchema.and(
	z.object({
		id: z.string(),
		conversation_id: z.string(),
	}),
);
