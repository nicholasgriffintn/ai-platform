import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";

import { requireAdmin, requireStrictAdmin } from "~/middleware/adminMiddleware";
import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  setAgentFeaturedStatus,
  moderateAgent,
  getAllSharedAgentsForAdmin,
} from "~/services/admin/sharedAgents";
import type { IEnv } from "~/types";
import { apiResponseSchema } from "./schemas/shared";
import {
  setAgentFeaturedSchema,
  moderateAgentSchema,
} from "./schemas/shared-agents";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("admin");

app.use("/*", async (ctx, next) => {
  logger.info(`Processing admin route: ${ctx.req.method} ${ctx.req.path}`);
  return next();
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
  zValidator("json", setAgentFeaturedSchema),
  async (ctx: Context) => {
    const { id } = ctx.req.param();
    const { featured } = ctx.req.valid("json" as never) as {
      featured: boolean;
    };

    const currentUser = ctx.get("user");

    const result = await setAgentFeaturedStatus(
      ctx.env,
      id,
      featured,
      currentUser,
    );

    if (!result.success) {
      return ctx.json(
        {
          status: "error",
          error: result.error,
        },
        400,
      );
    }

    return ctx.json({
      status: "success",
      data: result.data,
    });
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
    const agents = await getAllSharedAgentsForAdmin(ctx.env);

    return ctx.json({
      status: "success",
      data: agents,
    });
  },
);

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
    const { is_public, reason } = ctx.req.valid("json" as never) as {
      is_public: boolean;
      reason: string;
    };

    const currentUser = ctx.get("user");

    const result = await moderateAgent(
      ctx.env,
      id,
      is_public,
      reason,
      currentUser,
    );

    if (!result.success) {
      return ctx.json(
        {
          status: "error",
          error: result.error,
        },
        400,
      );
    }

    return ctx.json({
      status: "success",
      data: result.data,
    });
  },
);

export default app;
