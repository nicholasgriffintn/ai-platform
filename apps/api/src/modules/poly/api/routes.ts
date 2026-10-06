import {
  createPolyStandingApprovalSchema,
  errorResponseSchema,
  polyAgendaSchema,
  polyHomeSchema,
  revokePolyStandingApprovalSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { openPolyHome } from "~/modules/poly/application/home";
import { readPolyAgenda } from "~/modules/poly/application/read-agenda";
import {
  grantPolyStandingApproval,
  revokePolyStandingApproval,
} from "~/modules/poly/application/standing-approvals";

const app = new Hono();

addRoute(app, "get", "/home", {
  tags: ["poly"],
  summary: "Open Poly",
  description:
    "Return the signed-in user's Poly thread, creating their Poly context the first time.",
  auth: true,
  responses: {
    200: { description: "The user's Poly thread", schema: polyHomeSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext }) => openPolyHome(serviceContext),
});

addRoute(app, "get", "/agenda", {
  tags: ["poly"],
  summary: "Read Poly's agenda",
  description:
    "List what needs the signed-in user, what Poly is working on and what it finished in the last week.",
  auth: true,
  responses: {
    200: { description: "Poly's agenda", schema: polyAgendaSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext }) => readPolyAgenda(serviceContext),
});

addRoute(app, "post", "/standing-approvals", {
  tags: ["poly"],
  summary: "Always allow a waiting Poly action here",
  description:
    "Approve the write Poly is waiting on for the next thirty days, for that tool and destination only.",
  auth: true,
  bodySchema: createPolyStandingApprovalSchema,
  responses: {
    200: { description: "The user's Poly thread", schema: polyHomeSchema },
    400: { description: "The action cannot be allowed ahead of time", schema: errorResponseSchema },
    409: { description: "The approval is no longer waiting", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, body }) =>
    grantPolyStandingApproval(serviceContext, body.interaction_id),
});

addRoute(app, "delete", "/standing-approvals", {
  tags: ["poly"],
  summary: "Stop allowing a Poly action ahead of time",
  auth: true,
  bodySchema: revokePolyStandingApprovalSchema,
  responses: {
    200: { description: "The user's Poly thread", schema: polyHomeSchema },
  },
  handler: async ({ serviceContext, body }) =>
    revokePolyStandingApproval(serviceContext, {
      toolName: body.tool_name,
      destination: body.destination,
    }),
});

export default app;
