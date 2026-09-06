import {
  setTeammateFeaturedSchema,
  moderateTeammateSchema,
  apiResponseSchema,
  createTaskResponseSchema,
  planCreditsUpdateSchema,
  planParamsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import { z } from "zod/v4";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import { requireAdmin, requireStrictAdmin } from "~/middleware/adminMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  setTeammateFeaturedStatus,
  moderateTeammate,
  getAllSharedTeammatesForAdmin,
} from "~/services/admin/sharedTeammates";
import { updatePlanCredits } from "~/services/plans";
import { TaskService } from "~/services/tasks/TaskService";
import type { IEnv } from "~/types";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("admin");

app.use("/*", async (ctx, next) => {
  logger.info(`Processing admin route: ${ctx.req.method} ${ctx.req.path}`);

  return next();
});

const sharedTeammateParamsSchema = z.object({
  id: z.string().min(1),
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

addRoute(app, "put", "/shared-teammates/:id/featured", {
  tags: ["admin"],
  summary: "Set teammate featured status",
  description: "Mark an teammate as featured or unfeatured (admin only)",
  bodySchema: setTeammateFeaturedSchema,
  paramSchema: sharedTeammateParamsSchema,
  auth: true,
  responses: {
    "200": { description: "Success", schema: apiResponseSchema },
  },
  middleware: [requireStrictAdmin],
  handler: async ({ body, params, raw, serviceContext, user }) => {
    const result = await setTeammateFeaturedStatus({
      context: serviceContext,
      env: serviceContext.env,
      teammateId: params.id,
      featured: body.featured,
      moderator: user,
    });

    if (!result.success) {
      return ResponseFactory.error(raw, result.error || "Failed to set featured status", 400);
    }

    return result.data;
  },
});

addRoute(app, "get", "/shared-teammates", {
  tags: ["admin"],
  summary: "Get all shared teammates for admin review",
  description: "Get all shared teammates including non-public ones (admin only)",
  responses: {
    "200": { description: "Success", schema: apiResponseSchema },
  },
  auth: true,
  middleware: [requireAdmin],
  handler: async ({ serviceContext }) => getAllSharedTeammatesForAdmin({ context: serviceContext }),
});

addRoute(app, "put", "/shared-teammates/:id/moderate", {
  tags: ["admin"],
  summary: "Moderate shared teammate",
  description: "Approve or reject a shared teammate (admin only)",
  bodySchema: moderateTeammateSchema,
  paramSchema: sharedTeammateParamsSchema,
  auth: true,
  responses: {
    "200": { description: "Success", schema: apiResponseSchema },
  },
  middleware: [requireAdmin],
  handler: async ({ body, params, raw, serviceContext, user }) => {
    const result = await moderateTeammate({
      context: serviceContext,
      env: serviceContext.env,
      teammateId: params.id,
      isPublic: body.is_public,
      reason: body.reason,
      moderator: user,
    });

    if (!result.success) {
      return ResponseFactory.error(raw, result.error || "Failed to moderate teammate", 400);
    }

    return result.data;
  },
});

export default app;
