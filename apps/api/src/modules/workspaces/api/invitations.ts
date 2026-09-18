import {
  acceptWorkspaceInvitationSchema,
  workspaceDetailSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { acceptWorkspaceInvitation } from "~/modules/workspaces/application";

const app = new Hono();

addRoute(app, "post", "/accept", {
  auth: true,
  tags: ["workspaces"],
  summary: "Accept a secure workspace invitation",
  bodySchema: acceptWorkspaceInvitationSchema,
  responses: { 200: { description: "Joined workspace", schema: workspaceDetailSchema } },
  handler: ({ serviceContext, body }) => acceptWorkspaceInvitation(serviceContext, body.token),
});

export default app;
