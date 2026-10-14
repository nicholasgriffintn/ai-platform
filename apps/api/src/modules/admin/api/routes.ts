import {
  apiResponseSchema,
  createTaskResponseSchema,
  planCreditsUpdateSchema,
  planParamsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import { z } from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { requireStrictAdmin } from "~/middleware/adminMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { updatePlanCredits } from "~/modules/plans/application/plans";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("admin");

app.use("/*", async (ctx, next) => {
  logger.info(`Processing admin route: ${ctx.req.method} ${ctx.req.path}`);

  return next();
});

const modelSyncCompletedSchema = z.object({
  source: z.literal("models.dev"),
  completedAt: z.string(),
  write: z.boolean(),
  stats: z.record(z.string(), z.unknown()),
});

addRoute(app, "post", "/model-analysis/sync-completed", {
  tags: ["admin"],
  summary: "Queue Artificial Analysis model ingestion after model sync",
  description: "Queues the system task that refreshes cached Artificial Analysis model data.",
  bodySchema: modelSyncCompletedSchema,
  auth: true,
  middleware: [requireStrictAdmin],
  responses: {
    "200": { description: "Task queued", schema: createTaskResponseSchema },
  },
  handler: async ({ body, serviceContext }) => {
    const taskService = new TaskService(serviceContext.env, serviceContext.repositories.tasks);
    const taskId = await taskService.enqueueTask({
      task_type: "artificial_analysis_ingest",
      task_data: {
        source: body.source,
        completedAt: body.completedAt,
        write: body.write,
        stats: body.stats,
      },
      priority: 6,
      metadata: {
        trigger: "models_dev_sync_completed",
      },
    });

    return {
      task_id: taskId,
      status: "queued",
      message: "Artificial Analysis ingestion task queued",
    };
  },
});

addRoute(app, "put", "/plans/:id/credits", {
  tags: ["admin"],
  summary: "Set plan credits and Stripe metering configuration",
  description:
    "Set included credits, grace credits, the Stripe meter event name, and the overage price for a plan (admin only)",
  bodySchema: planCreditsUpdateSchema,
  paramSchema: planParamsSchema,
  auth: true,
  middleware: [requireStrictAdmin],
  responses: {
    "200": { description: "Plan updated", schema: apiResponseSchema },
  },
  handler: async ({ body, params, serviceContext }) =>
    updatePlanCredits(serviceContext.env, params.id, body),
});

export default app;
