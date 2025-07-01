import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { requireAdmin, requireStrictAdmin } from "~/middleware/adminMiddleware";
import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { SharedAgentRepository } from "~/repositories/SharedAgentRepository";
import { UserRepository } from "~/repositories/UserRepository";
import {
  sendAgentFeaturedNotification,
  sendAgentModerationNotification,
} from "~/services/notifications/agents";
import type { IEnv } from "~/types";
import { apiResponseSchema } from "./schemas/shared";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("ADMIN");

app.use("/*", async (ctx, next) => {
  logger.info(`Processing admin route: ${ctx.req.method} ${ctx.req.path}`);
  return next();
});

const setFeaturedSchema = z.object({
  featured: z
    .boolean()
    .openapi({ description: "Whether to feature the agent" }),
});

app.put(
  "/shared-agents/:id/featured",
  requireAuth,
  requireStrictAdmin,
  describeRoute({
    tags: ["admin"],
    summary: "Set agent featured status",
    description: "Mark an agent as featured or unfeatured (admin only)",
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", setFeaturedSchema),
  async (ctx: Context) => {
    const { id } = ctx.req.param();
    const { featured } = ctx.req.valid("json" as never) as z.infer<
      typeof setFeaturedSchema
    >;

    const repo = new SharedAgentRepository(ctx.env);

    try {
      const sharedAgent = await repo.getSharedAgentById(id);
      if (!sharedAgent) {
        return ctx.json(
          {
            status: "error",
            error: "Shared agent not found",
          },
          404,
        );
      }

      await repo.setFeatured(id, featured);

      if (featured) {
        const currentUser = ctx.get("user");
        const userRepo = new UserRepository(ctx.env);
        const agentOwner = await userRepo.getUserById(sharedAgent.user_id);

        if (agentOwner?.email) {
          await sendAgentFeaturedNotification(
            ctx.env,
            agentOwner.email,
            agentOwner.name || "User",
            {
              agentName: sharedAgent.name,
              agentId: sharedAgent.id,
              isFeatured: featured,
              moderatorName: currentUser?.name,
            },
          );
        }
      }

      return ctx.json({
        status: "success",
        data: { featured },
      });
    } catch (error) {
      return ctx.json(
        {
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to update featured status",
        },
        400,
      );
    }
  },
);

app.get(
  "/shared-agents",
  requireAuth,
  requireAdmin,
  describeRoute({
    tags: ["admin"],
    summary: "Get all shared agents for admin review",
    description: "Get all shared agents including non-public ones (admin only)",
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  async (ctx: Context) => {
    const repo = new SharedAgentRepository(ctx.env);

    const agents = await repo.getAllSharedAgentsForAdmin({});

    return ctx.json({
      status: "success",
      data: agents,
    });
  },
);

const moderateAgentSchema = z.object({
  is_public: z
    .boolean()
    .openapi({ description: "Whether the agent should be public" }),
  reason: z
    .string()
    .optional()
    .openapi({ description: "Reason for moderation action" }),
});

app.put(
  "/shared-agents/:id/moderate",
  requireAuth,
  requireAdmin,
  describeRoute({
    tags: ["admin"],
    summary: "Moderate shared agent",
    description: "Approve or reject a shared agent (admin only)",
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", moderateAgentSchema),
  async (ctx: Context) => {
    const { id } = ctx.req.param();
    const { is_public, reason } = ctx.req.valid("json" as never) as z.infer<
      typeof moderateAgentSchema
    >;

    const repo = new SharedAgentRepository(ctx.env);

    try {
      const sharedAgent = await repo.getSharedAgentById(id);
      if (!sharedAgent) {
        return ctx.json(
          {
            status: "error",
            error: "Shared agent not found",
          },
          404,
        );
      }

      await repo.moderateAgent(id, is_public);

      const currentUser = ctx.get("user");
      const userRepo = new UserRepository(ctx.env);
      const agentOwner = await userRepo.getUserById(sharedAgent.user_id);

      if (agentOwner?.email) {
        await sendAgentModerationNotification(
          ctx.env,
          agentOwner.email,
          agentOwner.name || "User",
          {
            agentName: sharedAgent.name,
            agentId: sharedAgent.id,
            isApproved: is_public,
            reason,
            moderatorName: currentUser?.name,
          },
        );
      }

      return ctx.json({
        status: "success",
        data: { is_public, reason },
      });
    } catch (error) {
      return ctx.json(
        {
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to moderate agent",
        },
        400,
      );
    }
  },
);

export default app;
