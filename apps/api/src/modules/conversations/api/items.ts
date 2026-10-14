import {
  conversationItemResponseSchema,
  conversationItemsQuerySchema,
  conversationItemsResponseSchema,
  conversationParamsSchema,
  conversationThreadsResponseSchema,
  errorResponseSchema,
  messageToItem,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ResourceBuilder } from "~/infrastructure/http/resource";

import { getConversationBranches } from "../application/conversationThreads";
import { handleGetChatMessageById, handleGetChatMessages } from "../application/getChatMessages";
import { presentItems } from "../application/present";

const itemLookupParamsSchema = z.object({ item_id: z.string().min(1) });

export function defineConversationItems(conversations: ResourceBuilder): void {
  conversations.sub("items", "item_id").list({
    auth: "user-or-anonymous",
    summary: "List conversation items",
    description: "Pages through the stored items of a conversation.",
    paramSchema: conversationParamsSchema,
    querySchema: conversationItemsQuerySchema,
    responses: {
      200: { description: "Items", schema: conversationItemsResponseSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params, query, anonymousUser }) => {
      const page = await handleGetChatMessages(
        serviceContext,
        anonymousUser ?? null,
        params.conversation_id,
        query.limit,
        query.after,
        query.before,
      );
      const data = presentItems(page.messages);

      return {
        object: "list" as const,
        conversation_id: page.conversation_id,
        data,
        has_more: page.has_more,
        last_id: page.oldest_message_id,
      };
    },
  });

  conversations.sub("branches", "branch_id").list({
    auth: true,
    summary: "List the conversation branch family",
    paramSchema: conversationParamsSchema,
    responses: {
      200: { description: "Conversation branches", schema: conversationThreadsResponseSchema },
    },
    handler: ({ serviceContext, params }) =>
      getConversationBranches(serviceContext, params.conversation_id),
  });

  conversations.collection("items", "item_id").read({
    auth: "user-or-anonymous",
    summary: "Get an item",
    description: "Returns one stored item by ID with its conversation.",
    paramSchema: itemLookupParamsSchema,
    responses: {
      200: { description: "The item", schema: conversationItemResponseSchema },
      404: { description: "Item not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params, anonymousUser }) => {
      const { message, conversation_id } = await handleGetChatMessageById(
        serviceContext,
        anonymousUser ?? null,
        params.item_id,
      );

      return { ...messageToItem(message), conversation_id };
    },
  });
}
