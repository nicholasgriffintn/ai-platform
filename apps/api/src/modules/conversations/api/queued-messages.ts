import {
  enqueueChatMessageRequestSchema,
  errorResponseSchema,
  queuedChatMessageItemParamsSchema,
  queuedChatMessageParamsSchema,
  queuedChatMessageSchema,
  queuedChatMessagesResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  listQueuedFollowUps,
  queueFollowUp,
  removeQueuedFollowUp,
} from "~/modules/chat-runs/application/follow-up-queue";

export function registerQueuedMessageRoutes(app: Hono): void {
  addRoute(app, "get", "/completions/:completion_id/queued-messages", {
    auth: true,
    tags: ["chat"],
    summary: "List queued follow-up messages",
    description: "Returns the messages waiting to be sent once the current reply finishes.",
    paramSchema: queuedChatMessageParamsSchema,
    responses: {
      200: { description: "Queued messages", schema: queuedChatMessagesResponseSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params }) => ({
      messages: await listQueuedFollowUps(serviceContext, params.completion_id),
    }),
  });

  addRoute(app, "post", "/completions/:completion_id/queued-messages", {
    auth: true,
    tags: ["chat"],
    summary: "Queue a follow-up message",
    description:
      "Queues a message to send as the next turn once the current reply finishes, even if this tab closes.",
    paramSchema: queuedChatMessageParamsSchema,
    bodySchema: enqueueChatMessageRequestSchema,
    responses: {
      200: { description: "Queued message", schema: queuedChatMessageSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
      409: { description: "Too many queued messages", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params, body }) =>
      queueFollowUp(serviceContext, params.completion_id, body),
  });

  addRoute(app, "delete", "/completions/:completion_id/queued-messages/:queued_id", {
    auth: true,
    tags: ["chat"],
    summary: "Remove a queued follow-up message",
    paramSchema: queuedChatMessageItemParamsSchema,
    responses: {
      200: { description: "Removal outcome" },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params }) =>
      removeQueuedFollowUp(serviceContext, params.completion_id, params.queued_id),
  });
}
