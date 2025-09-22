import { type Context, Hono, type Next } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";
import { z } from "zod/v4";

import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { allowRestrictedPaths } from "~/middleware/auth";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handleChatCompletionFeedbackSubmission } from "~/services/completions/chatCompletionFeedbackSubmission";
import { handleCheckChatCompletion } from "~/services/completions/checkChatCompletion";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { handleCountTokens } from "~/services/completions/countTokens";
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
  Message,
} from "~/types";
import {
  chatCompletionResponseSchema,
  checkChatCompletionJsonSchema,
  checkChatCompletionParamsSchema,
  countTokensJsonSchema,
  countTokensResponseSchema,
  createChatCompletionsJsonSchema,
  deleteChatCompletionParamsSchema,
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
} from "./schemas/chat";
import { errorResponseSchema, messageSchema } from "./schemas/shared";

const app = new Hono();

const routeLogger = createRouteLogger("chat");

app.use("/*", async (context: Context, next: Next) => {
  routeLogger.info(`Processing chat route: ${context.req.path}`);

  await allowRestrictedPaths(context, next);
});

app.post(
  "/completions",
  validateCaptcha,
  describeRoute({
    tags: ["chat"],
    summary: "Create chat completion",
    description:
      "Creates a model response for the given chat conversation. Please note that parameter support can differ depending on the model used to generate the response.",
    responses: {
      200: {
        description: "Chat completion response with model generation",
        content: {
          "application/json": {
            schema: resolver(chatCompletionResponseSchema),
          },
          "text/event-stream": {
            schema: resolver(z.string()),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", createChatCompletionsJsonSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as ChatCompletionParameters;

    const userContext = context.get("user");
    const anonymousUserContext = context.get("anonymousUser");

    const user = {
      // @ts-ignore
      longitude: context.req.cf?.longitude,
      // @ts-ignore
      latitude: context.req.cf?.latitude,
      ...userContext,
    };

    const response = await handleCreateChatCompletions({
      env: context.env as IEnv,
      request: body,
      user,
      anonymousUser: anonymousUserContext,
    });

    if (response instanceof Response) {
      return response;
    }

    return context.json(response);
  },
);

app.post(
  "/completions/count-tokens",
  validateCaptcha,
  describeRoute({
    tags: ["chat"],
    summary: "Count tokens for a chat request",
    description:
      "Count the number of tokens that would be used for a chat completion request. Useful for estimating costs and staying within token limits.",
    responses: {
      200: {
        description: "Token count result",
        content: {
          "application/json": {
            schema: resolver(countTokensResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", countTokensJsonSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as {
      model: string;
      messages: Message[];
      system_prompt?: string;
    };

    const userContext = context.get("user");

    const response = await handleCountTokens(
      {
        env: context.env as IEnv,
        user: userContext,
      },
      body,
    );

    return context.json(response);
  },
);

app.delete(
  "/completions",
  describeRoute({
    tags: ["chat"],
    summary: "Delete all chat completions",
    description: "Delete all chat completions for the current user",
    responses: {
      200: {
        description: "Deletion status",
      },
    },
  }),
  async (context: Context) => {
    const userContext = context.get("user");

    const response = await handleDeleteAllChatCompletions({
      env: context.env as IEnv,
      user: userContext,
    });

    return context.json(response);
  },
);

app.get(
  "/completions/:completion_id",
  describeRoute({
    tags: ["chat"],
    summary: "Get chat completion",
    description:
      "Get a stored chat completion. Only chat completions that have been created with the store parameter set to true will be returned.",
    responses: {
      200: {
        description: "Chat completion details",
        content: {
          "application/json": {
            schema: resolver(getChatCompletionResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Completion not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", getChatCompletionParamsSchema),
  async (context: Context) => {
    const { completion_id } = context.req.valid("param" as never) as {
      completion_id: string;
    };
    const userContext = context.get("user");

    const data = await handleGetChatCompletion(
      {
        env: context.env as IEnv,
        user: userContext,
      },
      completion_id,
    );

    return context.json(data);
  },
);

app.get(
  "/completions/:completion_id/messages",
  describeRoute({
    tags: ["chat"],
    summary: "Get chat messages",
    description:
      "Get the messages in a stored chat completion. Only chat completions that have been created with the store parameter set to true will be returned.",
    responses: {
      200: {
        description: "Messages for the specified chat completion",
        content: {
          "application/json": {
            schema: resolver(getChatCompletionMessagesResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Completion not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", getChatCompletionParamsSchema),
  async (context: Context) => {
    const { completion_id } = context.req.valid("param" as never) as {
      completion_id: string;
    };
    const userContext = context.get("user");
    const limit = Number.parseInt(context.req.query("limit") || "50", 10);
    const after = context.req.query("after");

    const database = Database.getInstance(context.env);
    const anonymousUser = context.get("anonymousUser");

    const conversationManager = ConversationManager.getInstance({
      database,
      user: userContext,
      anonymousUser,
    });

    const messages = await conversationManager.get(
      completion_id,
      undefined,
      limit,
      after,
    );

    return context.json({
      messages,
      conversation_id: completion_id,
    });
  },
);

app.get(
  "/completions/messages/:message_id",
  describeRoute({
    tags: ["chat"],
    summary: "Get message",
    description: "Get a single message by ID",
    responses: {
      200: {
        description: "Message details with conversation ID",
        content: {
          "application/json": {
            schema: resolver(getMessageResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Message not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const { message_id } = context.req.param();
    const user = context.get("user");
    const anonymousUser = context.get("anonymousUser");

    const database = Database.getInstance(context.env);

    const conversationManager = ConversationManager.getInstance({
      database,
      user,
      anonymousUser,
    });

    const { message, conversation_id } =
      await conversationManager.getMessageById(message_id);

    return context.json({
      ...message,
      conversation_id,
    });
  },
);

app.get(
  "/completions",
  validateCaptcha,
  describeRoute({
    tags: ["chat"],
    summary: "List chat completions",
    description:
      "List stored chat completions. Only chat completions that have been stored with the store parameter set to true will be returned.",
    responses: {
      200: {
        description: "List of chat completions with pagination metadata",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
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
            ),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const userContext = context.get("user");

    const limit = Number.parseInt(context.req.query("limit") || "25", 10);
    const page = Number.parseInt(context.req.query("page") || "1", 10);
    const includeArchived = context.req.query("include_archived") === "true";

    const response = await handleListChatCompletions(
      {
        env: context.env as IEnv,
        user: userContext,
      },
      {
        limit,
        page,
        includeArchived,
      },
    );

    return context.json(response);
  },
);

app.post(
  "/completions/:completion_id/generate-title",
  validateCaptcha,
  describeRoute({
    tags: ["chat"],
    summary: "Generate a title for a chat",
    description:
      "Generate a title for a chat completion and then update the metadata with the title.",
    responses: {
      200: {
        description: "Generated title with update status",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                success: z.boolean(),
                title: z.string(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Completion not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", generateChatCompletionTitleParamsSchema),
  zValidator("json", generateChatCompletionTitleJsonSchema),
  async (context: Context) => {
    const { completion_id } = context.req.valid("param" as never) as {
      completion_id: string;
    };
    const { messages, store } = context.req.valid("json" as never) as {
      messages: Message[];
      store: boolean;
    };
    const userContext = context.get("user");

    const requestObj = {
      env: context.env as IEnv,
      user: userContext,
    };

    const response = await handleGenerateChatCompletionTitle(
      requestObj,
      completion_id,
      messages,
      store,
    );

    return context.json(response);
  },
);

app.put(
  "/completions/:completion_id",
  describeRoute({
    tags: ["chat"],
    summary: "Update a chat completion",
    description:
      "Modify a stored chat completion. Only chat completions that have been created with the store parameter set to true can be modified.",
    responses: {
      200: {
        description: "Updated completion details",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
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
            ),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Completion not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", updateChatCompletionParamsSchema),
  zValidator("json", updateChatCompletionJsonSchema),
  async (context: Context) => {
    const { completion_id } = context.req.valid("param" as never) as {
      completion_id: string;
    };
    const updates = context.req.valid("json" as never);
    const userContext = context.get("user");

    const requestObj = {
      env: context.env as IEnv,
      user: userContext,
    };

    const response = await handleUpdateChatCompletion(
      requestObj,
      completion_id,
      updates,
    );

    return context.json(response);
  },
);

app.delete(
  "/completions/:completion_id",
  describeRoute({
    tags: ["chat"],
    summary: "Delete chat completion",
    description:
      "Delete a stored chat completion. Only chat completions that have been created with the store parameter set to true can be deleted.",
    responses: {
      200: {
        description: "Deletion status",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                success: z.boolean(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Completion not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", deleteChatCompletionParamsSchema),
  async (context: Context) => {
    const { completion_id } = context.req.valid("param" as never) as {
      completion_id: string;
    };
    const userContext = context.get("user");

    const requestObj = {
      env: context.env as IEnv,
      user: userContext,
    };

    const response = await handleDeleteChatCompletion(
      requestObj,
      completion_id,
    );

    return context.json(response);
  },
);

app.post(
  "/completions/:completion_id/check",
  describeRoute({
    tags: ["chat"],
    description: "Check a chat against guardrails",
    responses: {
      200: {
        description: "Guardrail check results",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                response: z.object({
                  status: z.string(),
                  flagged: z.boolean(),
                  reasons: z.array(z.string()).optional(),
                  category: z.array(z.string()).optional(),
                }),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Completion not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", checkChatCompletionParamsSchema),
  zValidator("json", checkChatCompletionJsonSchema),
  async (context: Context) => {
    const { completion_id } = context.req.valid("param" as never) as {
      completion_id: string;
    };
    const { role } = context.req.valid("json" as never) as {
      role: ChatRole;
    };
    const userContext = context.get("user");

    const requestObj = {
      env: context.env as IEnv,
      user: userContext,
    };

    const response = await handleCheckChatCompletion(
      requestObj,
      completion_id,
      role,
    );

    return context.json({
      response,
    });
  },
);

app.post(
  "/completions/:completion_id/feedback",
  validateCaptcha,
  describeRoute({
    tags: ["chat"],
    summary: "Submit feedback about a chat completion",
    responses: {
      200: {
        description: "Feedback submission status",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                response: z.object({
                  status: z.string(),
                  message: z.string(),
                }),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Completion not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", submitChatCompletionFeedbackParamsSchema),
  zValidator("json", submitChatCompletionFeedbackJsonSchema),
  async (context: Context) => {
    const { completion_id } = context.req.valid("param" as never) as {
      completion_id: string;
    };
    const body = context.req.valid("json" as never) as IFeedbackBody;
    const userContext = context.get("user");

    const requestObj = {
      request: body,
      env: context.env as IEnv,
      user: userContext,
      completion_id,
    };

    const response = await handleChatCompletionFeedbackSubmission(requestObj);

    return context.json({
      response,
    });
  },
);

app.post(
  "/completions/:completion_id/share",
  validateCaptcha,
  describeRoute({
    tags: ["chat"],
    summary: "Share a conversation publicly",
    description:
      "Make a conversation publicly accessible via a unique share link",
    responses: {
      200: {
        description: "Share ID for accessing the conversation",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                share_id: z.string(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Completion not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", shareConversationParamsSchema),
  async (context: Context) => {
    const { completion_id } = context.req.valid("param" as never) as {
      completion_id: string;
    };
    const userContext = context.get("user");

    const result = await handleShareConversation(
      {
        env: context.env as IEnv,
        user: userContext,
      },
      completion_id,
    );

    return context.json(result);
  },
);

app.delete(
  "/completions/:completion_id/share",
  describeRoute({
    tags: ["chat"],
    summary: "Unshare a conversation",
    description: "Make a previously shared conversation private",
    responses: {
      200: {
        description: "Unshare operation result",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                success: z.boolean(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Completion or share not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", unshareConversationParamsSchema),
  async (context: Context) => {
    const { completion_id } = context.req.valid("param" as never) as {
      completion_id: string;
    };
    const userContext = context.get("user");

    const result = await handleUnshareConversation(
      {
        env: context.env as IEnv,
        user: userContext,
      },
      completion_id,
    );

    return context.json(result);
  },
);

app.get(
  "/shared/:share_id",
  describeRoute({
    tags: ["chat"],
    summary: "Access a shared conversation",
    description:
      "Get messages from a publicly shared conversation using its share ID",
    responses: {
      200: {
        description: "Shared conversation messages and metadata",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                messages: z.array(messageSchema),
                conversation: z.object({
                  id: z.string(),
                  title: z.string().nullable(),
                  created_at: z.string(),
                  model: z.string(),
                }),
                share_id: z.string(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Shared conversation not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("param", getSharedConversationParamsSchema),
  async (context: Context) => {
    const { share_id } = context.req.valid("param" as never) as {
      share_id: string;
    };

    const limit = Number.parseInt(context.req.query("limit") || "50", 10);
    const after = context.req.query("after");

    const result = await handleGetSharedConversation(
      {
        env: context.env as IEnv,
      },
      share_id,
      limit,
      after,
    );

    return context.json(result);
  },
);

export default app;
