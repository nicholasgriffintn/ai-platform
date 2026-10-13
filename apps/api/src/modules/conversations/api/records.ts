import {
  archiveConversationsRequestSchema,
  archiveConversationsResponseSchema,
  conversationListResponseSchema,
  conversationParamsSchema,
  conversationSchema,
  deleteConversationResponseSchema,
  errorResponseSchema,
  generateConversationTitleRequestSchema,
  generateConversationTitleResponseSchema,
  getConversationQuerySchema,
  listConversationsQuerySchema,
  updateConversationRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import type { Message } from "~/types";

import { handleArchiveAllChatCompletions } from "../application/archiveAllChatCompletions";
import { handleDeleteAllChatCompletions } from "../application/deleteAllChatCompletions";
import { handleDeleteChatCompletion } from "../application/deleteChatCompletion";
import { handleGenerateChatCompletionTitle } from "../application/generateChatCompletionTitle";
import { handleGetChatCompletion } from "../application/getChatCompletion";
import { handleListChatCompletions } from "../application/listChatCompletions";
import { presentConversation, toApiMessages } from "../application/present";
import { handleUpdateChatCompletion } from "../application/updateChatCompletion";

export function registerConversationRecordRoutes(app: Hono): void {
  addRoute(app, "get", "/", {
    tags: ["conversations"],
    summary: "List conversations",
    description: "Lists stored conversations the caller can read, newest activity first.",
    querySchema: listConversationsQuerySchema,
    responses: {
      200: { description: "Conversations with pagination", schema: conversationListResponseSchema },
      400: { description: "Bad request or validation error", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha],
    handler: ({ serviceContext, query }) =>
      handleListChatCompletions(serviceContext, {
        archiveFilter: query.archived ?? "active",
        limit: query.limit,
        page: query.page,
        query: query.q,
        sortBy: query.sort_by,
        updatedAfter: query.updated_after,
      }),
  });

  addRoute(app, "delete", "/", {
    tags: ["conversations"],
    summary: "Delete all conversations",
    description: "Deletes every stored personal conversation for the caller.",
    responses: { 200: { description: "Deletion status" } },
    handler: ({ serviceContext }) => handleDeleteAllChatCompletions(serviceContext),
  });

  addRoute(app, "post", "/archive", {
    tags: ["conversations"],
    summary: "Archive or restore many conversations",
    description:
      "Sets the archived state of every stored personal conversation matching the filters. Only conversations not already in that state change.",
    bodySchema: archiveConversationsRequestSchema,
    responses: {
      200: {
        description: "Number of conversations changed",
        schema: archiveConversationsResponseSchema,
      },
      400: { description: "Bad request or validation error", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, body }) =>
      handleArchiveAllChatCompletions(serviceContext, {
        archived: body.archived,
        query: body.q,
        updatedAfter: body.updated_after,
      }),
  });

  addRoute(app, "get", "/:conversation_id", {
    tags: ["conversations"],
    summary: "Get a conversation",
    description: "Returns a stored conversation with its most recent items and latest response.",
    paramSchema: conversationParamsSchema,
    querySchema: getConversationQuerySchema,
    responses: {
      200: { description: "The conversation", schema: conversationSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params, query }) =>
      presentConversation(
        await handleGetChatCompletion(serviceContext, params.conversation_id, {
          refreshPending: query.refresh_pending === "true",
          messageLimit: query.item_limit,
        }),
      ),
  });

  addRoute(app, "patch", "/:conversation_id", {
    tags: ["conversations"],
    summary: "Update a conversation",
    description:
      "Changes the title, archive state, permission mode, branch parent or replaces the stored items.",
    paramSchema: conversationParamsSchema,
    bodySchema: updateConversationRequestSchema,
    responses: {
      200: { description: "The updated conversation", schema: conversationSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params, body }) => {
      const { items, ...updates } = body;

      return presentConversation(
        await handleUpdateChatCompletion(serviceContext, params.conversation_id, {
          ...updates,
          ...(items ? { messages: toApiMessages(items) } : {}),
        }),
      );
    },
  });

  addRoute(app, "delete", "/:conversation_id", {
    tags: ["conversations"],
    summary: "Delete a conversation",
    paramSchema: conversationParamsSchema,
    responses: {
      200: { description: "Deletion status", schema: deleteConversationResponseSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params }) =>
      handleDeleteChatCompletion(serviceContext, params.conversation_id),
  });

  addRoute(app, "post", "/:conversation_id/title", {
    tags: ["conversations"],
    summary: "Generate a title",
    description: "Generates a title from the conversation and stores it.",
    paramSchema: conversationParamsSchema,
    bodySchema: generateConversationTitleRequestSchema,
    responses: {
      200: { description: "Generated title", schema: generateConversationTitleResponseSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha],
    handler: ({ serviceContext, params, body }) =>
      handleGenerateChatCompletionTitle(
        serviceContext,
        params.conversation_id,
        body.items ? toApiMessages(body.items) : (body.messages as Message[] | undefined),
        body.store,
      ),
  });
}
