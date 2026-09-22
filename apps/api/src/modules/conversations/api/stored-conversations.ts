import {
  bulkArchiveChatCompletionsJsonSchema,
  bulkArchiveChatCompletionsResponseSchema,
  conversationArchiveFilterSchema,
  conversationSortBySchema,
  conversationTypeSchema,
  deleteChatCompletionParamsSchema,
  generateChatCompletionTitleJsonSchema,
  generateChatCompletionTitleParamsSchema,
  getChatCompletionParamsSchema,
  getChatCompletionResponseSchema,
  updateChatCompletionJsonSchema,
  updateChatCompletionParamsSchema,
  errorResponseSchema,
  messageSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Context, Hono } from "hono";
import z from "zod/v4";

import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { handleArchiveAllChatCompletions } from "~/modules/completions/application/archiveAllChatCompletions";
import { handleDeleteAllChatCompletions } from "~/modules/completions/application/deleteAllChatCompletions";
import { handleDeleteChatCompletion } from "~/modules/completions/application/deleteChatCompletion";
import { handleGenerateChatCompletionTitle } from "~/modules/completions/application/generateChatCompletionTitle";
import { handleGetChatCompletion } from "~/modules/completions/application/getChatCompletion";
import { handleListChatCompletions } from "~/modules/completions/application/listChatCompletions";
import { handleUpdateChatCompletion } from "~/modules/completions/application/updateChatCompletion";
import type { Message } from "~/types";

const getChatCompletionQuerySchema = z.object({
  refresh_pending: z.enum(["true", "false"]).optional().default("false"),
  message_limit: z.coerce.number().int().min(1).max(100).optional().default(100),
});

const chatCompletionsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  page: z.coerce.number().int().min(1).optional().default(1),
  archived: conversationArchiveFilterSchema.optional(),
  include_archived: z.enum(["true", "false"]).optional().default("false"),
  q: z.string().trim().max(200).optional(),
  sort_by: conversationSortBySchema.optional().default("updated"),
  updated_after: z.iso.datetime().optional(),
});

export function registerStoredConversationRoutes(app: Hono): void {
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

  addRoute(app, "patch", "/completions", {
    tags: ["chat"],
    summary: "Archive or restore many chat completions",
    description:
      "Set the archived state of every stored personal chat completion matching the supplied filters. Only conversations that are not already in the requested state are changed.",
    bodySchema: bulkArchiveChatCompletionsJsonSchema,
    responses: {
      200: {
        description: "Number of chat completions whose archived state changed",
        schema: bulkArchiveChatCompletionsResponseSchema,
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
    },
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const { archived, q, updated_after } = context.req.valid("json" as never) as z.infer<
          typeof bulkArchiveChatCompletionsJsonSchema
        >;

        const serviceContext = getServiceContext(context);

        const response = await handleArchiveAllChatCompletions(serviceContext, {
          archived,
          query: q,
          updatedAfter: updated_after,
        });

        return ResponseFactory.success(context, response);
      })(raw),
  });

  addRoute(app, "get", "/completions/:completion_id", {
    tags: ["chat"],
    summary: "Get chat completion",
    description:
      "Get a stored chat completion. Only chat completions that have been created with the store parameter set to true will be returned.",
    paramSchema: getChatCompletionParamsSchema,
    querySchema: getChatCompletionQuerySchema,
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
        const query = context.req.valid("query" as never) as z.infer<
          typeof getChatCompletionQuerySchema
        >;

        const serviceContext = getServiceContext(context);
        const refreshPending = query.refresh_pending === "true";

        const data = await handleGetChatCompletion(serviceContext, completion_id, {
          refreshPending,
          messageLimit: query.message_limit,
        });

        return ResponseFactory.success(context, data);
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
              type: conversationTypeSchema,
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
        const { archived, include_archived, limit, page, q, sort_by, updated_after } =
          context.req.valid("query" as never) as z.infer<typeof chatCompletionsListQuerySchema>;
        const archiveFilter = archived ?? (include_archived === "true" ? "all" : "active");

        const serviceContext = getServiceContext(context);

        const response = await handleListChatCompletions(serviceContext, {
          archiveFilter,
          limit,
          page,
          query: q,
          sortBy: sort_by,
          updatedAfter: updated_after,
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
        schema: getChatCompletionResponseSchema
          .extend({
            messages: z.array(messageSchema).optional(),
          })
          .passthrough(),
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

        const response = await handleUpdateChatCompletion(serviceContext, completion_id, updates);

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

        const response = await handleDeleteChatCompletion(serviceContext, completion_id);

        return ResponseFactory.success(context, response);
      })(raw),
  });
}
