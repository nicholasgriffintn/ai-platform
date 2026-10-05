import { errorResponseSchema, polyHomeSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { openPolyHome } from "~/modules/poly/application/home";

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

export default app;
