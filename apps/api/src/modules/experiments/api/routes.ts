import { flagBootstrapResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { buildFlagBootstrap } from "~/modules/experiments/application/bootstrap";

const app = new Hono();

addRoute(app, "get", "/bootstrap", {
  tags: ["flags"],
  summary: "Evaluate every registered flag and experiment for the caller",
  description:
    "Returns the caller's assignments so clients can seed their OpenFeature provider with the same bucketing the API uses.",
  responses: {
    200: { description: "Flag evaluations for the caller", schema: flagBootstrapResponseSchema },
  },
  handler: async ({ serviceContext }) => buildFlagBootstrap(serviceContext),
});

export default app;
