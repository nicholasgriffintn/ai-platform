import {
  assignConversationLabelSchema,
  conversationLabelParamsSchema,
  conversationLabelSchema,
  conversationOrganisationParamsSchema,
  conversationOrganisationSchema,
  createConversationLabelSchema,
  updateConversationOrganisationSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";
import {
  createConversationLabel,
  deleteConversationLabel,
  getConversationOrganisation,
  setConversationLabel,
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

  addRoute(app, "put", "/completions/:completionId/labels", {
    tags: ["chat"],
    auth: true,
    paramSchema: conversationOrganisationParamsSchema,
    bodySchema: assignConversationLabelSchema,
    responses: {
      200: { description: "Updated conversation labels", schema: conversationOrganisationSchema },
    },
    handler: ({ body, params, serviceContext }) =>
      setConversationLabel(serviceContext, params.completionId, body.labelId, body.assigned),
  });

  addRoute(app, "post", "/labels", {
    tags: ["chat"],
    auth: true,
    bodySchema: createConversationLabelSchema,
    responses: {
      200: {
        description: "Created conversation label",
        schema: conversationLabelSchema,
      },
      409: { description: "A label with the same name already exists" },
    },
    handler: async ({ body, serviceContext }) =>
      (await createConversationLabel(serviceContext, body)).label,
  });

  addRoute(app, "delete", "/labels/:labelId", {
    tags: ["chat"],
    auth: true,
    paramSchema: conversationLabelParamsSchema,
    responses: { 200: { description: "Conversation label deleted" } },
    handler: async ({ params, serviceContext }) => {
      await deleteConversationLabel(serviceContext, params.labelId);

      return { deleted: true };
    },
  });
}
