import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { Database } from "~/lib/database";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  planParamsSchema,
  planResponseSchema,
  plansResponseSchema,
} from "./schemas/plans";
import { errorResponseSchema } from "./schemas/shared";

const app = new Hono();
const routeLogger = createRouteLogger("PLANS");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing plans route: ${c.req.path}`);
  return next();
});

app.get(
  "/",
  describeRoute({
    tags: ["plans"],
    summary: "List subscription plans",
    responses: {
      200: {
        description: "Subscription plans",
        content: {
          "application/json": { schema: resolver(plansResponseSchema) },
        },
      },
    },
  }),
  async (c: Context) => {
    const db = Database.getInstance(c.env);
    const plans = await db.getAllPlans();
    return c.json({ success: true, data: plans });
  },
);

app.get(
  "/:id",
  describeRoute({
    tags: ["plans"],
    summary: "Get subscription plan",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: z.string(),
        description: "Plan ID",
      },
    ],
    responses: {
      200: {
        description: "Plan found",
        content: {
          "application/json": { schema: resolver(planResponseSchema) },
        },
      },
      404: {
        description: "Not found",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
    },
  }),
  zValidator("param", planParamsSchema),
  async (c: Context) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const db = Database.getInstance(c.env);
    const plan = await db.getPlanById(id);
    if (!plan) {
      throw new AssistantError("Plan not found", ErrorType.NOT_FOUND);
    }
    return c.json({ success: true, data: plan });
  },
);

export default app;
