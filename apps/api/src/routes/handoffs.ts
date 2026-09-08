import {
  createHandoffRequestSchema,
  errorResponseSchema,
  handoffDecisionResponseSchema,
  handoffSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createHandoff, claimHandoff, decideHandoff, getHandoff } from "~/services/handoffs";

const app = new Hono();
const idParams = z.object({ id: z.string().trim().min(1).max(128) });
const machineBody = z.object({ machineId: z.string().trim().min(1).max(128) }).strict();
const decisionBody = machineBody.extend({
  state: z.enum(["running", "done", "declined"]),
});

addRoute(app, "get", "/:id", {
  tags: ["handoffs"],
  summary: "Get a machine handoff",
  description: "Returns the current state of an account handoff, expiring stale pending work.",
  auth: true,
  paramSchema: idParams,
  responses: {
    200: { description: "Handoff", schema: handoffSchema },
    400: { description: "Handoff unavailable", schema: errorResponseSchema },
  },
  handler: async ({ params, serviceContext }) => getHandoff(serviceContext, params.id),
});

addRoute(app, "post", "/", {
  tags: ["handoffs"],
  summary: "Create a machine handoff",
  description: "Queues one typed conversation turn for an online machine owned by the account.",
  auth: true,
  bodySchema: createHandoffRequestSchema,
  responses: {
    200: { description: "Handoff created", schema: handoffSchema },
    400: { description: "Invalid handoff", schema: errorResponseSchema },
  },
  handler: async ({ body, serviceContext }) => createHandoff(serviceContext, body),
});

addRoute(app, "post", "/:id/claim", {
  tags: ["handoffs"],
  summary: "Claim a machine handoff",
  description: "Exclusively claims a pending handoff for the owning machine.",
  auth: true,
  paramSchema: idParams,
  bodySchema: machineBody,
  responses: {
    200: { description: "Handoff claimed", schema: handoffDecisionResponseSchema },
    400: { description: "Handoff unavailable", schema: errorResponseSchema },
  },
  handler: async ({ params, body, serviceContext }) => ({
    handoff: await claimHandoff(serviceContext, params.id, body.machineId),
  }),
});

addRoute(app, "post", "/:id/decision", {
  tags: ["handoffs"],
  summary: "Update a machine handoff",
  description: "Records the owning machine's running, completed, or declined state.",
  auth: true,
  paramSchema: idParams,
  bodySchema: decisionBody,
  responses: {
    200: { description: "Handoff updated", schema: handoffDecisionResponseSchema },
    400: { description: "Handoff unavailable", schema: errorResponseSchema },
  },
  handler: async ({ params, body, serviceContext }) => ({
    handoff: await decideHandoff(serviceContext, params.id, body.machineId, body.state),
  }),
});

export default app;
