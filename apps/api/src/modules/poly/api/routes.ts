import {
  errorResponseSchema,
  polyAgendaSchema,
  polyHandoffDisagreementSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { disagreeWithPolyHandoff } from "~/modules/poly/application/handoff-disagreement";
import { readPolyAgenda } from "~/modules/poly/application/read-agenda";

const app = new Hono();

addRoute(app, "get", "/agenda", {
  tags: ["poly"],
  summary: "Read Poly's agenda",
  description:
    "The signed-in user's Poly: its thread, autonomy and standing approvals, what needs the user, what Poly is working on and what it finished in the last week. Creates the user's Poly the first time.",
  auth: true,
  responses: {
    200: { description: "Poly's agenda", schema: polyAgendaSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext }) => readPolyAgenda(serviceContext),
});

addRoute(app, "post", "/handoffs/:handoff_id/disagree", {
  tags: ["poly"],
  summary: "Tell Poly it should not have kept a result quiet",
  description:
    "Record a rule that results from the same routine always reach you, and return where the result is.",
  auth: true,
  paramSchema: z.object({ handoff_id: z.string().min(1) }),
  responses: {
    200: { description: "The rule and the result", schema: polyHandoffDisagreementSchema },
    404: { description: "Not in your Poly thread", schema: errorResponseSchema },
    409: { description: "Poly already told you", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    disagreeWithPolyHandoff(serviceContext, params.handoff_id),
});

export default app;
