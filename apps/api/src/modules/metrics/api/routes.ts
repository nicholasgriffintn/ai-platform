import { metricsParamsSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { requireStrictAdmin } from "~/middleware/adminMiddleware";
import { getMetrics } from "~/modules/metrics/application/getMetrics";

const app = new Hono();

addRoute(app, "get", "/", {
  tags: ["system"],
  summary: "Query recent telemetry",
  description: "Reads recent events and metrics from the Basin telemetry table.",
  querySchema: metricsParamsSchema,
  middleware: [requireStrictAdmin],
  responses: {
    200: { description: "Metrics retrieved successfully" },
  },
  handler: async ({ serviceContext, query }) => ({
    metrics: await getMetrics(serviceContext.env, {
      limit: Math.min(Number(query.limit) || 100, 500),
      timeframeHours: Math.min(Number(query.timeframe) || 24, 72),
      environment: query.environment,
      app: query.app,
      type: query.type,
      status: query.status,
    }),
  }),
});

export default app;
