import {
  adminTaskDetailSchema,
  adminTaskParamsSchema,
  adminTasksQuerySchema,
  adminTasksResponseSchema,
  createTaskResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import { z } from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { requireStrictAdmin } from "~/middleware/adminMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  cancelAdminTask,
  listAdminTasks,
  readAdminTask,
  retryAdminTask,
} from "~/modules/admin/application/tasks";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
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

addRoute(app, "get", "/tasks", {
  tags: ["admin"],
  summary: "See background tasks across every account",
  description:
    "Summarises the last day of work by task type, and lists the most recently updated tasks for the chosen view and type.",
  querySchema: adminTasksQuerySchema,
  auth: true,
  middleware: [requireStrictAdmin],
  responses: {
    "200": { description: "Background tasks", schema: adminTasksResponseSchema },
  },
  handler: async ({ query, serviceContext }) => listAdminTasks(serviceContext, query),
});

defineResource(app, { path: "/tasks", idParam: "task_id", tags: ["admin"] }, (tasks) => {
  tasks
    .read({
      auth: true,
      middleware: [requireStrictAdmin],
      summary: "Read a background task, its workflow run and its steps",
      paramSchema: adminTaskParamsSchema,
      responses: { 200: { description: "Task detail", schema: adminTaskDetailSchema } },
      handler: ({ params, serviceContext }) => readAdminTask(serviceContext, params.task_id),
    })
    .action("retry", {
      auth: true,
      middleware: [requireStrictAdmin],
      summary: "Start a fresh run for a failed or cancelled task",
      paramSchema: adminTaskParamsSchema,
      responses: { 200: { description: "Task detail", schema: adminTaskDetailSchema } },
      handler: ({ params, serviceContext }) => retryAdminTask(serviceContext, params.task_id),
    })
    .action("cancel", {
      auth: true,
      middleware: [requireStrictAdmin],
      summary: "Cancel a task and stop its workflow run",
      paramSchema: adminTaskParamsSchema,
      responses: { 200: { description: "Task detail", schema: adminTaskDetailSchema } },
      handler: ({ params, serviceContext }) => cancelAdminTask(serviceContext, params.task_id),
    });
});

export default app;
