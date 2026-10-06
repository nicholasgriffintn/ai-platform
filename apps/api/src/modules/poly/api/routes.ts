import {
  errorResponseSchema,
  polyAgendaSchema,
  polyHomeSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { openPolyHome } from "~/modules/poly/application/home";
import { readPolyAgenda } from "~/modules/poly/application/read-agenda";

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

export default app;
