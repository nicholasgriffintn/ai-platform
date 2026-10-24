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

import type { ResourceBuilder } from "~/infrastructure/http/resource";
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

export function defineConversationRecords(conversations: ResourceBuilder): void {
  conversations
    .list({
      auth: true,
      summary: "List conversations",
      description:
        "Lists stored conversations the caller can read, pinned first, then newest activity.",
      querySchema: listConversationsQuerySchema,
      responses: {
        200: { description: "A page of conversations", schema: conversationListResponseSchema },
        400: { description: "Bad request or validation error", schema: errorResponseSchema },
      },
      middleware: [validateCaptcha],
      handler: ({ serviceContext, query }) =>
        handleListChatCompletions(serviceContext, {
          archiveFilter: query.archived ?? "active",
          limit: query.limit,
          after: query.after,
          query: query.q,
          sortBy: query.sort_by,
          updatedAfter: query.updated_after,
          teammateThreads: query.teammate_threads ?? "include",
          subject:
            query.subject_type && query.subject_id
              ? { type: query.subject_type, id: query.subject_id }
              : undefined,
        }),
    })
    .deleteAll({
      auth: true,
      summary: "Delete all conversations",
      description: "Deletes every stored personal conversation for the caller.",
      responses: { 200: { description: "Deletion status" } },
      handler: ({ serviceContext }) => handleDeleteAllChatCompletions(serviceContext),
    })
    .collectionAction("archive", {
      auth: true,
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
          teammateThreads: body.teammate_threads ?? "include",
        }),
    })
    .read({
      auth: "user-or-anonymous",
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
    })
    .update({
      auth: "user-or-anonymous",
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
    })
    .delete({
      auth: "user-or-anonymous",
      summary: "Delete a conversation",
      paramSchema: conversationParamsSchema,
      responses: {
        200: { description: "Deletion status", schema: deleteConversationResponseSchema },
        404: { description: "Conversation not found", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, params }) =>
        handleDeleteChatCompletion(serviceContext, params.conversation_id),
    })
    .action("title", {
      auth: "user-or-anonymous",
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
