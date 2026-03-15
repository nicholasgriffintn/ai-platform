import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono, type Next } from "hono";

import z from "zod/v4";
import {
	chatCompletionResponseSchema,
	editCompletionResponseSchema,
	checkChatCompletionJsonSchema,
	checkChatCompletionParamsSchema,
	countTokensJsonSchema,
	countTokensResponseSchema,
	createChatCompletionsJsonSchema,
	nextEditRequestSchema,
	applyEditRequestSchema,
	deleteChatCompletionParamsSchema,
	fillInMiddleRequestSchema,
	fillInMiddleResponseSchema,
	generateChatCompletionTitleJsonSchema,
	generateChatCompletionTitleParamsSchema,
	getChatCompletionMessagesResponseSchema,
	getChatCompletionParamsSchema,
	getChatCompletionResponseSchema,
	getMessageResponseSchema,
	getSharedConversationParamsSchema,
	shareConversationParamsSchema,
	submitChatCompletionFeedbackJsonSchema,
	submitChatCompletionFeedbackParamsSchema,
	unshareConversationParamsSchema,
	updateChatCompletionJsonSchema,
	updateChatCompletionParamsSchema,
	errorResponseSchema,
	messageSchema,
} from "@assistant/schemas";

import { allowRestrictedPaths } from "~/middleware/auth";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { sseResponse } from "~/lib/http/streaming";
import { handleChatCompletionFeedbackSubmission } from "~/services/completions/chatCompletionFeedbackSubmission";
import { handleCheckChatCompletion } from "~/services/completions/checkChatCompletion";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { handleCreateFimCompletions } from "~/services/completions/createFimCompletions";
import { handleCreateNextEditCompletions } from "~/services/completions/createNextEditCompletions";
import { handleCreateApplyEditCompletions } from "~/services/completions/createApplyEditCompletions";
import { handleCountTokens } from "~/services/completions/countTokens";
import {
	handleGetChatMessageById,
	handleGetChatMessages,
} from "~/services/completions/getChatMessages";
import { handleDeleteAllChatCompletions } from "~/services/completions/deleteAllChatCompletions";
import { handleDeleteChatCompletion } from "~/services/completions/deleteChatCompletion";
import { handleGenerateChatCompletionTitle } from "~/services/completions/generateChatCompletionTitle";
import { handleGetChatCompletion } from "~/services/completions/getChatCompletion";
import { handleGetSharedConversation } from "~/services/completions/getSharedConversation";
import { handleListChatCompletions } from "~/services/completions/listChatCompletions";
import { handleShareConversation } from "~/services/completions/shareConversation";
import { handleUnshareConversation } from "~/services/completions/unshareConversation";
import { handleUpdateChatCompletion } from "~/services/completions/updateChatCompletion";
import type {
	ChatCompletionParameters,
	ChatRole,
	IEnv,
	IFeedbackBody,
	IUser,
	Message,
} from "~/types";

const app = new Hono();

const routeLogger = createRouteLogger("chat");
const chatMessageListQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional().default(50),
	after: z.string().optional(),
});

const chatCompletionsListQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional().default(25),
	page: z.coerce.number().int().min(1).optional().default(1),
	include_archived: z.enum(["true", "false"]).optional().default("false"),
});

function respondWithStreamOrJson(
	_context: Context,
	result: unknown,
	stream?: boolean,
): Response {
	if (stream) {
		return sseResponse(result as ReadableStream);
	}
	return ResponseFactory.success(_context, result);
}

app.use("/*", async (context: Context, next: Next) => {
	routeLogger.info(`Processing chat route: ${context.req.path}`);

	await allowRestrictedPaths(context, next);
});

addRoute(app, "post", "/completions", {
	tags: ["chat"],
	summary: "Create chat completion",
	description:
		"Creates a model response for the given chat conversation. Please note that parameter support can differ depending on the model used to generate the response.",
	bodySchema: createChatCompletionsJsonSchema,
	responses: {
		200: {
			description: "Chat completion response with model generation",
			schema: chatCompletionResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		401: { description: "Authentication error", schema: errorResponseSchema },
	},
	middleware: [validateCaptcha],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid(
				"json" as never,
			) as ChatCompletionParameters;

			const userContext = context.get("user");
			const anonymousUserContext = context.get("anonymousUser");
			const serviceContext = getServiceContext(context);

			const user = {
				// @ts-ignore
				longitude: context.req.cf?.longitude,
				// @ts-ignore
				latitude: context.req.cf?.latitude,
				...userContext,
			};

			if (user?.id) {
				try {
					await serviceContext.getUserSettings();
				} catch (error) {
					routeLogger.warn("Failed to preload user settings", {
						requestId: serviceContext.requestId,
						error,
					});
				}
			}

			const response = await handleCreateChatCompletions({
				env: context.env as IEnv,
				request: body,
				user,
				anonymousUser: anonymousUserContext,
				context: serviceContext,
				executionCtx: context.executionCtx,
			});

			if (response instanceof Response) {
				return response;
			}

			return ResponseFactory.success(context, response);
		})(raw),
});

addRoute(app, "post", "/fim/completions", {
	tags: ["chat", "code"],
	summary: "Create fill-in-the-middle completion",
	description:
		"Generates code completions by filling the gap between a prefix and suffix using supported FIM models.",
	bodySchema: fillInMiddleRequestSchema,
	responses: {
		200: {
			description: "Fill-in-the-middle completion response",
			schema: fillInMiddleResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		401: { description: "Authentication error", schema: errorResponseSchema },
	},
	middleware: [validateCaptcha],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as z.infer<
				typeof fillInMiddleRequestSchema
			>;

			const result = await handleCreateFimCompletions({
				env: context.env as IEnv,
				user: context.get("user") as IUser | undefined,
				...body,
			});

			return respondWithStreamOrJson(context, result, body.stream);
		})(raw),
});

addRoute(app, "post", "/edit/completions", {
	tags: ["chat", "code"],
	summary: "Create next edit completion",
	description:
		"Produces the next edit suggestion for a file using Mercury's code edit model.",
	bodySchema: nextEditRequestSchema,
	responses: {
		200: {
			description: "Edit suggestion response",
			schema: editCompletionResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
	},
	middleware: [validateCaptcha],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as z.infer<
				typeof nextEditRequestSchema
			>;

			const result = await handleCreateNextEditCompletions({
				env: context.env as IEnv,
				user: context.get("user") as IUser | undefined,
				...body,
			});

			return respondWithStreamOrJson(context, result, body.stream);
		})(raw),
});

addRoute(app, "post", "/apply/completions", {
	tags: ["chat", "code"],
	summary: "Apply edit completion",
	description:
		"Applies an edit snippet to existing code using Mercury's apply edit capability.",
	bodySchema: applyEditRequestSchema,
	responses: {
		200: {
			description: "Edit application response",
			schema: editCompletionResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
	},
	middleware: [validateCaptcha],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as z.infer<
				typeof applyEditRequestSchema
			>;

			const result = await handleCreateApplyEditCompletions({
				env: context.env as IEnv,
				user: context.get("user") as IUser | undefined,
				...body,
			});

			return respondWithStreamOrJson(context, result, body.stream);
		})(raw),
});

addRoute(app, "post", "/completions/count-tokens", {
	tags: ["chat"],
	summary: "Count tokens for a chat request",
	description:
		"Count the number of tokens that would be used for a chat completion request. Useful for estimating costs and staying within token limits.",
	bodySchema: countTokensJsonSchema,
	responses: {
		200: {
			description: "Token count result",
			schema: countTokensResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		401: { description: "Authentication error", schema: errorResponseSchema },
	},
	middleware: [validateCaptcha],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const body = context.req.valid("json" as never) as {
				model: string;
				messages: Message[];
				system_prompt?: string;
			};

			const serviceContext = getServiceContext(context);

			const response = await handleCountTokens(serviceContext, body);

			return ResponseFactory.success(context, response);
		})(raw),
});

addRoute(app, "delete", "/completions", {
	tags: ["chat"],
	summary: "Delete all chat completions",
	description: "Delete all chat completions for the current user",
	responses: {
		200: { description: "Deletion status" },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const serviceContext = getServiceContext(context);

			const response = await handleDeleteAllChatCompletions(serviceContext);

			return ResponseFactory.success(context, response);
		})(raw),
});

addRoute(app, "get", "/completions/:completion_id", {
	tags: ["chat"],
	summary: "Get chat completion",
	description:
		"Get a stored chat completion. Only chat completions that have been created with the store parameter set to true will be returned.",
	paramSchema: getChatCompletionParamsSchema,
	responses: {
		200: {
			description: "Chat completion details",
			schema: getChatCompletionResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Completion not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { completion_id } = context.req.valid("param" as never) as {
				completion_id: string;
			};

			const serviceContext = getServiceContext(context);

			const data = await handleGetChatCompletion(serviceContext, completion_id);

			return ResponseFactory.success(context, data);
		})(raw),
});

addRoute(app, "get", "/completions/:completion_id/messages", {
	tags: ["chat"],
	summary: "Get chat messages",
	description:
		"Get the messages in a stored chat completion. Only chat completions that have been created with the store parameter set to true will be returned.",
	paramSchema: getChatCompletionParamsSchema,
	querySchema: chatMessageListQuerySchema,
	responses: {
		200: {
			description: "Messages for the specified chat completion",
			schema: getChatCompletionMessagesResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Completion not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { completion_id } = context.req.valid("param" as never) as {
				completion_id: string;
			};
			const { limit, after } = context.req.valid("query" as never) as z.infer<
				typeof chatMessageListQuerySchema
			>;

			const anonymousUser = context.get("anonymousUser");

			const serviceContext = getServiceContext(context);

			const { messages, conversation_id } = await handleGetChatMessages(
				serviceContext,
				anonymousUser,
				completion_id,
				limit,
				after,
			);

			return ResponseFactory.success(context, {
				messages,
				conversation_id,
			});
		})(raw),
});

addRoute(app, "get", "/completions/messages/:message_id", {
	tags: ["chat"],
	summary: "Get message",
	description: "Get a single message by ID",
	responses: {
		200: {
			description: "Message details with conversation ID",
			schema: getMessageResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Message not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { message_id } = context.req.param();
			const anonymousUser = context.get("anonymousUser");

			const serviceContext = getServiceContext(context);

			const { message, conversation_id } = await handleGetChatMessageById(
				serviceContext,
				anonymousUser,
				message_id,
			);

			return ResponseFactory.success(context, {
				...message,
				conversation_id,
			});
		})(raw),
});

addRoute(app, "get", "/completions", {
	tags: ["chat"],
	summary: "List chat completions",
	description:
		"List stored chat completions. Only chat completions that have been stored with the store parameter set to true will be returned.",
	querySchema: chatCompletionsListQuerySchema,
	responses: {
		200: {
			description: "List of chat completions with pagination metadata",
			schema: z.object({
				data: z.array(
					z.object({
						id: z.string(),
						title: z.string().nullable(),
						created_at: z.string(),
						updated_at: z.string(),
						model: z.string(),
						is_archived: z.boolean(),
						user_id: z.string(),
						share_id: z.string().nullable(),
					}),
				),
				total: z.number(),
				page: z.number(),
				limit: z.number(),
				pages: z.number(),
			}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
	},
	middleware: [validateCaptcha],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { limit, page, include_archived } = context.req.valid(
				"query" as never,
			) as z.infer<typeof chatCompletionsListQuerySchema>;
			const includeArchived = include_archived === "true";

			const serviceContext = getServiceContext(context);

			const response = await handleListChatCompletions(serviceContext, {
				limit,
				page,
				includeArchived,
			});

			return ResponseFactory.success(context, response);
		})(raw),
});

addRoute(app, "post", "/completions/:completion_id/generate-title", {
	tags: ["chat"],
	summary: "Generate a title for a chat",
	description:
		"Generate a title for a chat completion and then update the metadata with the title.",
	bodySchema: generateChatCompletionTitleJsonSchema,
	paramSchema: generateChatCompletionTitleParamsSchema,
	responses: {
		200: {
			description: "Generated title with update status",
			schema: z.object({
				success: z.boolean(),
				title: z.string(),
			}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Completion not found", schema: errorResponseSchema },
	},
	middleware: [validateCaptcha],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { completion_id } = context.req.valid("param" as never) as {
				completion_id: string;
			};
			const { messages, store } = context.req.valid("json" as never) as {
				messages: Message[];
				store: boolean;
			};

			const serviceContext = getServiceContext(context);

			const response = await handleGenerateChatCompletionTitle(
				serviceContext,
				completion_id,
				messages,
				store,
			);

			return ResponseFactory.success(context, response);
		})(raw),
});

addRoute(app, "put", "/completions/:completion_id", {
	tags: ["chat"],
	summary: "Update a chat completion",
	description:
		"Modify a stored chat completion. Only chat completions that have been created with the store parameter set to true can be modified.",
	bodySchema: updateChatCompletionJsonSchema,
	paramSchema: updateChatCompletionParamsSchema,
	responses: {
		200: {
			description: "Updated completion details",
			schema: z.object({
				success: z.boolean(),
				data: z.object({
					id: z.string(),
					title: z.string().nullable(),
					created_at: z.string(),
					updated_at: z.string(),
					model: z.string(),
					is_archived: z.boolean(),
					user_id: z.string(),
					share_id: z.string().nullable(),
				}),
			}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Completion not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { completion_id } = context.req.valid("param" as never) as {
				completion_id: string;
			};
			const updates = context.req.valid("json" as never);

			const serviceContext = getServiceContext(context);

			const response = await handleUpdateChatCompletion(
				serviceContext,
				completion_id,
				updates,
			);

			return ResponseFactory.success(context, response);
		})(raw),
});

addRoute(app, "delete", "/completions/:completion_id", {
	tags: ["chat"],
	summary: "Delete chat completion",
	description:
		"Delete a stored chat completion. Only chat completions that have been created with the store parameter set to true can be deleted.",
	paramSchema: deleteChatCompletionParamsSchema,
	responses: {
		200: {
			description: "Deletion status",
			schema: z.object({
				success: z.boolean(),
			}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Completion not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { completion_id } = context.req.valid("param" as never) as {
				completion_id: string;
			};

			const serviceContext = getServiceContext(context);

			const response = await handleDeleteChatCompletion(
				serviceContext,
				completion_id,
			);

			return ResponseFactory.success(context, response);
		})(raw),
});

addRoute(app, "post", "/completions/:completion_id/check", {
	tags: ["chat", "guardrails"],
	description: "Check a chat against guardrails",
	bodySchema: checkChatCompletionJsonSchema,
	paramSchema: checkChatCompletionParamsSchema,
	responses: {
		200: {
			description: "Guardrail check results",
			schema: z.object({
				response: z.object({
					status: z.string(),
					flagged: z.boolean(),
					reasons: z.array(z.string()).optional(),
					category: z.array(z.string()).optional(),
				}),
			}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Completion not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { completion_id } = context.req.valid("param" as never) as {
				completion_id: string;
			};
			const { role } = context.req.valid("json" as never) as {
				role: ChatRole;
			};

			const serviceContext = getServiceContext(context);

			const response = await handleCheckChatCompletion(
				serviceContext,
				completion_id,
				role,
			);

			return ResponseFactory.success(context, {
				response,
			});
		})(raw),
});

addRoute(app, "post", "/completions/:completion_id/feedback", {
	tags: ["chat"],
	summary: "Submit feedback about a chat completion",
	bodySchema: submitChatCompletionFeedbackJsonSchema,
	paramSchema: submitChatCompletionFeedbackParamsSchema,
	responses: {
		200: {
			description: "Feedback submission status",
			schema: z.object({
				response: z.object({
					status: z.string(),
					message: z.string(),
				}),
			}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Completion not found", schema: errorResponseSchema },
	},
	middleware: [validateCaptcha],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { completion_id } = context.req.valid("param" as never) as {
				completion_id: string;
			};
			const body = context.req.valid("json" as never) as IFeedbackBody;

			const serviceContext = getServiceContext(context);

			const response = await handleChatCompletionFeedbackSubmission(
				serviceContext,
				{ request: body, completion_id },
			);

			return ResponseFactory.success(context, {
				response,
			});
		})(raw),
});

addRoute(app, "post", "/completions/:completion_id/share", {
	tags: ["chat"],
	summary: "Share a conversation publicly",
	description:
		"Make a conversation publicly accessible via a unique share link",
	paramSchema: shareConversationParamsSchema,
	responses: {
		200: {
			description: "Share ID for accessing the conversation",
			schema: z.object({
				share_id: z.string(),
			}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: { description: "Completion not found", schema: errorResponseSchema },
	},
	middleware: [validateCaptcha],
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { completion_id } = context.req.valid("param" as never) as {
				completion_id: string;
			};

			const serviceContext = getServiceContext(context);

			const result = await handleShareConversation(
				serviceContext,
				completion_id,
			);

			return ResponseFactory.success(context, result);
		})(raw),
});

addRoute(app, "delete", "/completions/:completion_id/share", {
	tags: ["chat"],
	summary: "Unshare a conversation",
	description: "Make a previously shared conversation private",
	paramSchema: unshareConversationParamsSchema,
	responses: {
		200: {
			description: "Unshare operation result",
			schema: z.object({
				success: z.boolean(),
			}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: {
			description: "Completion or share not found",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { completion_id } = context.req.valid("param" as never) as {
				completion_id: string;
			};

			const serviceContext = getServiceContext(context);

			const result = await handleUnshareConversation(
				serviceContext,
				completion_id,
			);

			return ResponseFactory.success(context, result);
		})(raw),
});

addRoute(app, "get", "/shared/:share_id", {
	tags: ["chat"],
	summary: "Access a shared conversation",
	description:
		"Get messages from a publicly shared conversation using its share ID",
	paramSchema: getSharedConversationParamsSchema,
	querySchema: chatMessageListQuerySchema,
	responses: {
		200: {
			description: "Shared conversation messages and metadata",
			schema: z.object({
				messages: z.array(messageSchema),
				conversation: z.object({
					id: z.string(),
					title: z.string().nullable(),
					created_at: z.string(),
					model: z.string(),
				}),
				share_id: z.string(),
			}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		404: {
			description: "Shared conversation not found",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (context: Context) => {
			const { share_id } = context.req.valid("param" as never) as {
				share_id: string;
			};
			const { limit, after } = context.req.valid("query" as never) as z.infer<
				typeof chatMessageListQuerySchema
			>;

			const serviceContext = getServiceContext(context);

			const result = await handleGetSharedConversation(
				serviceContext,
				share_id,
				limit,
				after,
			);

			return ResponseFactory.success(context, result);
		})(raw),
});

export default app;
