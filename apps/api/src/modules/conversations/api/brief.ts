import {
  conversationBriefResponseSchema,
  conversationParamsSchema,
  updateMemoryDocumentSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ResourceBuilder } from "~/infrastructure/http/resource";
import {
  ensureConversationBrief,
  getConversationBrief,
  updateConversationBrief,
} from "~/modules/memory-documents/application/memory-documents";

export function defineConversationBrief(conversations: ResourceBuilder): void {
  conversations
    .singleton("brief")
    .read({
      auth: true,
      summary: "Read the conversation brief",
      paramSchema: conversationParamsSchema,
      responses: { 200: { description: "The brief", schema: conversationBriefResponseSchema } },
      handler: ({ serviceContext, params }) =>
        getConversationBrief(serviceContext, params.conversation_id),
    })
    .create({
      auth: true,
      summary: "Start the conversation brief",
      paramSchema: conversationParamsSchema,
      responses: { 200: { description: "The brief", schema: conversationBriefResponseSchema } },
      handler: ({ serviceContext, params }) =>
        ensureConversationBrief(serviceContext, params.conversation_id),
    })
    .update({
      auth: true,
      summary: "Save the conversation brief",
      paramSchema: conversationParamsSchema,
      bodySchema: updateMemoryDocumentSchema,
      handler: ({ serviceContext, params, body }) =>
        updateConversationBrief(serviceContext, params.conversation_id, body),
    });
}
