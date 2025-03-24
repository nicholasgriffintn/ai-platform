import { type Context, Hono, type Next } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { ConversationManager } from "../lib/conversationManager";
import { allowRestrictedPaths } from "../middleware/auth";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import { requireTurnstileToken } from "../middleware/turnstile";
import { handleChatCompletionFeedbackSubmission } from "../services/completions/chatCompletionFeedbackSubmission";
import { handleCheckChatCompletion } from "../services/completions/checkChatCompletion";
import { handleCreateChatCompletions } from "../services/completions/createChatCompletions";
import { handleDeleteChatCompletion } from "../services/completions/deleteChatCompletion";
import { handleGenerateChatCompletionTitle } from "../services/completions/generateChatCompletionTitle";
import { handleGetChatCompletion } from "../services/completions/getChatCompletion";
import { handleListChatCompletions } from "../services/completions/listChatCompletions";
import { handleUpdateChatCompletion } from "../services/completions/updateChatCompletion";
import type {
  ChatCompletionParameters,
  ChatRole,
  IEnv,
  IFeedbackBody,
  Message,
} from "../types";
import {
  checkChatCompletionJsonSchema,
  checkChatCompletionParamsSchema,
  createChatCompletionsJsonSchema,
  deleteChatCompletionParamsSchema,
  generateChatCompletionTitleJsonSchema,
  generateChatCompletionTitleParamsSchema,
  getChatCompletionParamsSchema,
  submitChatCompletionFeedbackJsonSchema,
  submitChatCompletionFeedbackParamsSchema,
  updateChatCompletionJsonSchema,
  updateChatCompletionParamsSchema,
} from "./schemas/chat";

const app = new Hono();

const routeLogger = createRouteLogger("CHAT");

/**
 * Global middleware
 */
app.use("/*", async (context: Context, next: Next) => {
  routeLogger.info(`Processing chat route: ${context.req.path}`);

  await allowRestrictedPaths(context, next);
});

app.post(
  "/completions",
  describeRoute({
    tags: ["chat"],
    title: "Create chat completion",
    description:
      "Creates a model response for the given chat conversation. Please note that parameter support can differ depending on the model used to generate the response.",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
          "text/event-stream": {
            schema: resolver(z.string()),
          },
        },
      },
    },
  }),
  requireTurnstileToken,
  zValidator("json", createChatCompletionsJsonSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as ChatCompletionParameters;

    const userContext = context.get("user");

    const user = {
      // @ts-ignore
      longitude: context.req.cf?.longitude,
      // @ts-ignore
      latitude: context.req.cf?.latitude,
      email: userContext?.email,
      id: userContext?.id,
    };

    const response = await handleCreateChatCompletions({
      env: context.env as IEnv,
      request: body,
      user,
      isRestricted: context.get("isRestricted"),
    });

    if (response instanceof Response) {
      return response;
    }

    return context.json(response);
  },
);

app.get(
  "/completions/:completion_id",
  describeRoute({
    tags: ["chat"],
    title: "Get chat completion",
    description:
      "Get a stored chat completion. Only chat completions that have been created with the store parameter set to true will be returned.",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
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
    title: "Get chat messages",
    description:
      "Get the messages in a stored chat completion. Only chat completions that have been created with the store parameter set to true will be returned.",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
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

    const conversationManager = ConversationManager.getInstance({
      database: context.env.DB,
      userId: userContext.id,
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
    title: "Get message",
    description: "Get a single message by ID",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const { message_id } = context.req.param();
    const userContext = context.get("user");

    const conversationManager = ConversationManager.getInstance({
      database: context.env.DB,
      userId: userContext.id,
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
  describeRoute({
    tags: ["chat"],
    title: "List chat completions",
    description:
      "List stored chat completions. Only chat completions that have been stored with the store parameter set to true will be returned.",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
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
  describeRoute({
    tags: ["chat"],
    title: "Generate a title for a chat",
    description:
      "Generate a title for a chat completion and then update the metadata with the title.",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
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
    title: "Update a chat completion",
    description:
      "Modify a stored chat completion. Only chat completions that have been created with the store parameter set to true can be modified.",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
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
    title: "Delete chat completion",
    description:
      "Delete a stored chat completion. Only chat completions that have been created with the store parameter set to true can be deleted.",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
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
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
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
  describeRoute({
    tags: ["chat"],
    title: "Submit feedback about a chat completion",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
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

export default app;
