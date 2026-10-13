import {
  conversationParamsSchema,
  enqueueChatMessageRequestSchema,
  errorResponseSchema,
  queuedChatMessageSchema,
  queuedChatMessagesResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  listQueuedFollowUps,
  queueFollowUp,
  removeQueuedFollowUp,
} from "~/modules/responses/application/runs/follow-up-queue";

const queuedItemParamsSchema = conversationParamsSchema.extend({ queued_id: z.string().min(1) });

export function registerConversationQueueRoutes(app: Hono): void {
  addRoute(app, "get", "/:conversation_id/queue", {
    auth: true,
    tags: ["conversations"],
    summary: "List queued follow-up messages",
    description: "Returns the user messages waiting to be sent once the current response finishes.",
    paramSchema: conversationParamsSchema,
    responses: {
      200: { description: "Queued messages", schema: queuedChatMessagesResponseSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params }) => ({
      messages: await listQueuedFollowUps(serviceContext, params.conversation_id),
    }),
  });

  addRoute(app, "post", "/:conversation_id/queue", {
    auth: true,
    tags: ["conversations"],
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
  });

  addRoute(app, "delete", "/:conversation_id/queue/:queued_id", {
    auth: true,
    tags: ["conversations"],
    summary: "Remove a queued follow-up message",
    paramSchema: queuedItemParamsSchema,
    responses: {
      200: { description: "Removal outcome" },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params }) =>
      removeQueuedFollowUp(serviceContext, params.conversation_id, params.queued_id),
  });
}
