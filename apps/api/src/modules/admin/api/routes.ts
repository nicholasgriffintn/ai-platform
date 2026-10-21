import {
  createTaskResponseSchema,
  teammateTrustCheckTaskSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import { z } from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { requireStrictAdmin } from "~/middleware/adminMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { enqueueTeammateTrustCheck } from "~/modules/teammates/application/trust-check/schedule";
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

addRoute(app, "post", "/model_analysis/ingestions", {
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
    const taskService = new TaskService(
      serviceContext.env,
      serviceContext.repositories.get(TaskRepository),
    );
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

addRoute(app, "post", "/teammate_trust_checks", {
  tags: ["admin"],
  summary: "Run the built-in teammate trust check now",
  description:
    "Dry-runs every built-in teammate except Poly against notes that smuggle in instructions to send, delete or buy, and saves a report to the caller's Files. Any attempted effect fails the teammate.",
  bodySchema: teammateTrustCheckTaskSchema,
  auth: true,
  middleware: [requireStrictAdmin],
  responses: {
    "200": { description: "Task queued", schema: createTaskResponseSchema },
  },
  handler: async ({ body, serviceContext }) => {
    const taskId = await enqueueTeammateTrustCheck(
      serviceContext.env,
      serviceContext.requireUser().id,
      body,
    );

    return {
      task_id: taskId,
      status: "queued",
      message: "Teammate trust check queued; the report lands in your Files",
    };
  },
});

export default app;
