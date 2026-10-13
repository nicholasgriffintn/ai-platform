import {
  conversationGroupParamsSchema,
  conversationGroupSchema,
  conversationOrganisationSchema,
  conversationParamsSchema,
  createConversationGroupSchema,
  updateConversationOrganisationSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ResourceBuilder } from "~/infrastructure/http/resource";

import {
  changeConversationOrganisation,
  createConversationGroup,
  deleteConversationGroup,
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
        "Pins, marks unread, snoozes or moves the conversation into a group. Pin, unread and snooze changes need the current revision.",
      paramSchema: conversationParamsSchema,
      bodySchema: updateConversationOrganisationSchema,
      responses: {
        200: { description: "Updated organisation", schema: conversationOrganisationSchema },
        404: { description: "The group does not exist in the conversation's scope" },
        409: { description: "The organisation revision changed" },
      },
      handler: ({ body, params, serviceContext }) =>
        changeConversationOrganisation(serviceContext, params.conversation_id, body),
    });

  conversations
    .collection("groups", "group_id")
    .create({
      auth: true,
      summary: "Create a conversation group",
      bodySchema: createConversationGroupSchema,
      responses: {
        200: { description: "Created conversation group", schema: conversationGroupSchema },
        409: { description: "A group with the same name already exists" },
      },
      handler: async ({ body, serviceContext }) =>
        (await createConversationGroup(serviceContext, body)).group,
    })
    .delete({
      auth: true,
      summary: "Delete a conversation group",
      paramSchema: conversationGroupParamsSchema,
      responses: { 200: { description: "Conversation group deleted" } },
      handler: async ({ params, serviceContext }) => {
        await deleteConversationGroup(serviceContext, params.group_id);

        return { deleted: true };
      },
    });
}
