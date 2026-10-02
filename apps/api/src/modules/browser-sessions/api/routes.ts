import {
  browserAvailabilitySchema,
  browserScopeQuerySchema,
  browserSessionParamsSchema,
  browserSessionSchema,
  submitBrowserApprovalSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { getBrowserAvailability } from "~/modules/browser-sessions/application/access";
import {
  destroyBrowserSession,
  inspectBrowserSession,
  respondToBrowserApproval,
  stopBrowserSession,
} from "~/modules/browser-sessions/application/sessions";

const app = new Hono();

app.use("*", async (context, next) => {
  context.header("Cache-Control", "no-store");
  await next();
});

addRoute(app, "get", "/availability", {
  auth: true,
  tags: ["tools"],
  summary: "Check hosted browser availability",
  querySchema: browserScopeQuerySchema,
  responses: { 200: { description: "Browser availability", schema: browserAvailabilitySchema } },
  handler: ({ serviceContext, query }) =>
    getBrowserAvailability(serviceContext, query.projectId, query.workspaceId),
});

addRoute(app, "get", "/:id", {
  auth: true,
  tags: ["tools"],
  summary: "Inspect an owned browser session",
  paramSchema: browserSessionParamsSchema,
  responses: {
    200: { description: "Browser state and pending requests", schema: browserSessionSchema },
  },
  handler: ({ serviceContext, params }) => inspectBrowserSession(serviceContext, params.id),
});

addRoute(app, "post", "/:id/approvals", {
  auth: true,
  tags: ["tools"],
  summary: "Answer a pending browser approval or sign-in request",
  paramSchema: browserSessionParamsSchema,
  bodySchema: submitBrowserApprovalSchema,
  handler: ({ serviceContext, params, body }) =>
    respondToBrowserApproval(serviceContext, params.id, body),
});

addRoute(app, "post", "/:id/stop", {
  auth: true,
  tags: ["tools"],
  summary: "Cancel the browser's active task",
  paramSchema: browserSessionParamsSchema,
  handler: ({ serviceContext, params }) => stopBrowserSession(serviceContext, params.id),
});

addRoute(app, "delete", "/:id", {
  auth: true,
  tags: ["tools"],
  summary: "Close an owned browser session",
  paramSchema: browserSessionParamsSchema,
  handler: ({ serviceContext, params }) => destroyBrowserSession(serviceContext, params.id),
});

export default app;
