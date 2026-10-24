import {
  conversationOrganisationSchema,
  conversationParamsSchema,
  updateConversationOrganisationSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ResourceBuilder } from "~/infrastructure/http/resource";

import {
  changeConversationOrganisation,
  getConversationOrganisation,
} from "../application/conversation-organisation";

export function defineConversationOrganisation(conversations: ResourceBuilder): void {
  conversations
    .singleton("organisation")
    .read({
      auth: true,
      summary: "Get personal organisation",
      paramSchema: conversationParamsSchema,
      responses: {
        200: {
          description: "Personal conversation organisation",
          schema: conversationOrganisationSchema,
        },
      },
      handler: ({ params, serviceContext }) =>
        getConversationOrganisation(serviceContext, params.conversation_id),
    })
    .update({
      auth: true,
      summary: "Update personal organisation",
      description:
        "Pins, marks unread, snoozes or moves the conversation into a notebook. Pin, unread and snooze changes need the current revision.",
      paramSchema: conversationParamsSchema,
      bodySchema: updateConversationOrganisationSchema,
      responses: {
        200: { description: "Updated organisation", schema: conversationOrganisationSchema },
        404: { description: "The notebook does not exist in the conversation's scope" },
        409: { description: "The organisation revision changed" },
      },
      handler: ({ body, params, serviceContext }) =>
        changeConversationOrganisation(serviceContext, params.conversation_id, body),
    });
}
