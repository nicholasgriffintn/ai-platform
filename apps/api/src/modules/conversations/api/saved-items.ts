import {
  errorResponseSchema,
  listSavedItemsQuerySchema,
  saveItemSchema,
  savedItemListSchema,
  savedItemParamsSchema,
  savedItemSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ResourceBuilder } from "~/infrastructure/http/resource";

import { listSavedItems, saveItem, unsaveItem } from "../application/saved-items";

export function defineSavedItems(conversations: ResourceBuilder): void {
  conversations
    .collection("saved_items", "item_id")
    .list({
      auth: true,
      summary: "List saved items",
      description:
        "The conversation items the caller has kept for later, newest first. Filter by conversation_id to read one conversation's saved items.",
      querySchema: listSavedItemsQuerySchema,
      responses: { 200: { description: "Saved items", schema: savedItemListSchema } },
      handler: ({ serviceContext, query }) =>
        listSavedItems(serviceContext, {
          limit: query.limit,
          after: query.after,
          conversationId: query.conversation_id,
        }),
    })
    .create({
      auth: true,
      summary: "Save an item for later",
      bodySchema: saveItemSchema,
      responses: {
        200: { description: "The saved item", schema: savedItemSchema },
        404: { description: "Item not found in the conversation", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, body }) => saveItem(serviceContext, body),
    })
    .delete({
      auth: true,
      summary: "Stop keeping an item",
      paramSchema: savedItemParamsSchema,
      responses: { 200: { description: "Deletion status" } },
      handler: ({ serviceContext, params }) => unsaveItem(serviceContext, params.item_id),
    });
}
