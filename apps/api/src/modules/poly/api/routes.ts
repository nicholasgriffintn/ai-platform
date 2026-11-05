import {
  errorResponseSchema,
  polyAgendaSchema,
  polyHandoffDisagreementSchema,
  polyLookAroundSchema,
  polyRoutineParamsSchema,
  polyRoutineSetupSchema,
  polyRoutinesSchema,
  setupPolyRoutineSchema,
  updatePolyLookAroundSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { disagreeWithPolyHandoff } from "~/modules/poly/application/handoff-disagreement";
import { setPolyLookAround } from "~/modules/poly/application/look-around";
import { readPolyAgenda } from "~/modules/poly/application/read-agenda";
import {
  readPolyRoutines,
  removePolyRoutine,
  setupPolyRoutine,
} from "~/modules/poly/application/routines";

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

addRoute(app, "patch", "/look-around", {
  tags: ["poly"],
  summary: "Turn Poly's daily look around on or off",
  description:
    "Installs or removes Poly's read-only daily pass over your connected sources. It only reads and drafts, whatever Poly's autonomy is set to.",
  auth: true,
  bodySchema: updatePolyLookAroundSchema,
  responses: {
    200: { description: "Whether Poly looks around", schema: polyLookAroundSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, body }) => setPolyLookAround(serviceContext, body),
});

addRoute(app, "get", "/routines", {
  tags: ["poly"],
  summary: "Read Poly's routines and today's briefs",
  description:
    "The five bounded routines Poly can run for you, which are on, the briefs from the last day and where approvals can reach you.",
  auth: true,
  responses: {
    200: { description: "Routines and briefs", schema: polyRoutinesSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext }) => readPolyRoutines(serviceContext),
});

addRoute(app, "post", "/routines", {
  tags: ["poly"],
  summary: "Turn on one of Poly's routines",
  description:
    "Schedules a routine under Poly. Each one has a fixed set of tools and sources and asks before anything changes.",
  auth: true,
  bodySchema: setupPolyRoutineSchema,
  responses: {
    200: { description: "The routine", schema: polyRoutineSetupSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, body }) => setupPolyRoutine(serviceContext, body),
});

addRoute(app, "delete", "/routines/:template_id", {
  tags: ["poly"],
  summary: "Turn off one of Poly's routines",
  auth: true,
  paramSchema: polyRoutineParamsSchema,
  responses: {
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    removePolyRoutine(serviceContext, params.template_id),
});

export default app;
