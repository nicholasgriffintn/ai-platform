import {
  conversationGroupParamsSchema,
  conversationGroupSchema,
  conversationOrganisationParamsSchema,
  conversationOrganisationSchema,
  createConversationGroupSchema,
  moveConversationToGroupSchema,
  updateConversationOrganisationSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";
import {
  createConversationGroup,
  deleteConversationGroup,
  getConversationOrganisation,
  moveConversationToGroup,
  updateConversationOrganisation,
} from "~/services/conversation-organisation";

export function registerConversationOrganisationRoutes(app: Hono): void {
  addRoute(app, "get", "/completions/:completionId/organisation", {
    tags: ["chat"],
    auth: true,
    paramSchema: conversationOrganisationParamsSchema,
    responses: {
      200: {
        description: "Personal conversation organisation",
        schema: conversationOrganisationSchema,
      },
    },
    handler: ({ params, serviceContext }) =>
      getConversationOrganisation(serviceContext, params.completionId),
  });

  addRoute(app, "patch", "/completions/:completionId/organisation", {
    tags: ["chat"],
    auth: true,
    paramSchema: conversationOrganisationParamsSchema,
    bodySchema: updateConversationOrganisationSchema,
    responses: {
      200: {
        description: "Updated personal conversation organisation",
        schema: conversationOrganisationSchema,
      },
      409: { description: "The organisation revision changed" },
    },
    handler: ({ body, params, serviceContext }) =>
      updateConversationOrganisation(serviceContext, params.completionId, body),
  });

  addRoute(app, "put", "/completions/:completionId/group", {
    tags: ["chat"],
    auth: true,
    paramSchema: conversationOrganisationParamsSchema,
    bodySchema: moveConversationToGroupSchema,
    responses: {
      200: { description: "Updated conversation group", schema: conversationOrganisationSchema },
      404: { description: "The group does not exist in the conversation's scope" },
    },
    handler: ({ body, params, serviceContext }) =>
      moveConversationToGroup(serviceContext, params.completionId, body.groupId),
  });

  addRoute(app, "post", "/groups", {
    tags: ["chat"],
    auth: true,
    bodySchema: createConversationGroupSchema,
    responses: {
      200: {
        description: "Created conversation group",
        schema: conversationGroupSchema,
      },
      409: { description: "A group with the same name already exists" },
    },
    handler: async ({ body, serviceContext }) =>
      (await createConversationGroup(serviceContext, body)).group,
  });

  addRoute(app, "delete", "/groups/:groupId", {
    tags: ["chat"],
    auth: true,
    paramSchema: conversationGroupParamsSchema,
    responses: { 200: { description: "Conversation group deleted" } },
    handler: async ({ params, serviceContext }) => {
      await deleteConversationGroup(serviceContext, params.groupId);

      return { deleted: true };
    },
  });
}
