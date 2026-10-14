import {
  conversationParamsSchema,
  enqueueChatMessageRequestSchema,
  errorResponseSchema,
  listPageOf,
  queuedChatMessageSchema,
  queuedChatMessagesResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ResourceBuilder } from "~/infrastructure/http/resource";
import {
  listQueuedFollowUps,
  queueFollowUp,
  removeQueuedFollowUp,
} from "~/modules/responses/application/runs/follow-up-queue";

const queuedItemParamsSchema = conversationParamsSchema.extend({
  queued_item_id: z.string().min(1),
});

export function defineConversationQueue(conversations: ResourceBuilder): void {
  conversations
    .sub("queue", "queued_item_id")
    .list({
      auth: true,
      summary: "List queued follow-up messages",
      description:
        "Returns the user messages waiting to be sent once the current response finishes.",
      paramSchema: conversationParamsSchema,
      responses: {
        200: { description: "Queued messages", schema: queuedChatMessagesResponseSchema },
        404: { description: "Conversation not found", schema: errorResponseSchema },
      },
      handler: async ({ serviceContext, params }) =>
        listPageOf(
          await listQueuedFollowUps(serviceContext, params.conversation_id),
          (message) => message.id,
        ),
    })
    .create({
      auth: true,
      summary: "Queue a follow-up message",
      description:
        "Queues a user message to send as the next turn once the current response finishes, even if this tab closes.",
      paramSchema: conversationParamsSchema,
      bodySchema: enqueueChatMessageRequestSchema,
      responses: {
        200: { description: "Queued message", schema: queuedChatMessageSchema },
        404: { description: "Conversation not found", schema: errorResponseSchema },
        409: { description: "Too many queued messages", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, params, body }) =>
        queueFollowUp(serviceContext, params.conversation_id, body),
    })
    .delete({
      auth: true,
      summary: "Remove a queued follow-up message",
      paramSchema: queuedItemParamsSchema,
      responses: {
        200: { description: "Removal outcome" },
        404: { description: "Conversation not found", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, params }) =>
        removeQueuedFollowUp(serviceContext, params.conversation_id, params.queued_item_id),
    });
}
