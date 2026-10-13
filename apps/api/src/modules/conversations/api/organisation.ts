import {
  conversationGroupParamsSchema,
  conversationGroupSchema,
  conversationOrganisationSchema,
  conversationParamsSchema,
  createConversationGroupSchema,
  moveConversationToGroupSchema,
  updateConversationOrganisationSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";

import {
  createConversationGroup,
  deleteConversationGroup,
  getConversationOrganisation,
  moveConversationToGroup,
  updateConversationOrganisation,
} from "../application/conversation-organisation";

export function registerConversationOrganisationRoutes(app: Hono): void {
  addRoute(app, "get", "/:conversation_id/organisation", {
    tags: ["conversations"],
    summary: "Get personal organisation",
    auth: true,
    paramSchema: conversationParamsSchema,
    responses: {
      200: {
        description: "Personal conversation organisation",
        schema: conversationOrganisationSchema,
      },
    },
    handler: ({ params, serviceContext }) =>
      getConversationOrganisation(serviceContext, params.conversation_id),
  });

  addRoute(app, "patch", "/:conversation_id/organisation", {
    tags: ["conversations"],
    summary: "Update personal organisation",
    auth: true,
    paramSchema: conversationParamsSchema,
    bodySchema: updateConversationOrganisationSchema,
    responses: {
      200: { description: "Updated organisation", schema: conversationOrganisationSchema },
      409: { description: "The organisation revision changed" },
    },
    handler: ({ body, params, serviceContext }) =>
      updateConversationOrganisation(serviceContext, params.conversation_id, body),
  });

  addRoute(app, "put", "/:conversation_id/group", {
    tags: ["conversations"],
    summary: "Move a conversation into a group",
    auth: true,
    paramSchema: conversationParamsSchema,
    bodySchema: moveConversationToGroupSchema,
    responses: {
      200: { description: "Updated conversation group", schema: conversationOrganisationSchema },
      404: { description: "The group does not exist in the conversation's scope" },
    },
    handler: ({ body, params, serviceContext }) =>
      moveConversationToGroup(serviceContext, params.conversation_id, body.groupId),
  });

  addRoute(app, "post", "/groups", {
    tags: ["conversations"],
    summary: "Create a conversation group",
    auth: true,
    bodySchema: createConversationGroupSchema,
    responses: {
      200: { description: "Created conversation group", schema: conversationGroupSchema },
      409: { description: "A group with the same name already exists" },
    },
    handler: async ({ body, serviceContext }) =>
      (await createConversationGroup(serviceContext, body)).group,
  });

  addRoute(app, "delete", "/groups/:groupId", {
    tags: ["conversations"],
    summary: "Delete a conversation group",
    auth: true,
    paramSchema: conversationGroupParamsSchema,
    responses: { 200: { description: "Conversation group deleted" } },
    handler: async ({ params, serviceContext }) => {
      await deleteConversationGroup(serviceContext, params.groupId);

      return { deleted: true };
    },
  });
}
