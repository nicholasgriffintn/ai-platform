import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";
import type z from "zod/v4";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { SharedAgentRepository } from "~/repositories/SharedAgentRepository";
import type { IEnv } from "~/types";
import { apiResponseSchema } from "../schemas/shared";
import {
  agentRatingsSchema,
  featuredAgentsSchema,
  rateAgentSchema,
  shareAgentSchema,
  sharedAgentFiltersSchema,
  updateSharedAgentSchema,
} from "../schemas/shared-agents";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("SHARED_AGENTS");

app.use("/*", async (ctx, next) => {
  logger.info(
    `Processing shared agents route: ${ctx.req.method} ${ctx.req.path}`,
  );
  return next();
});

app.get(
  "/",
  describeRoute({
    tags: ["shared-agents"],
    summary: "Get a list of shared agents",
    description:
      "Get a list of shared agents with optional filtering and sorting",
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
  zValidator("query", sharedAgentFiltersSchema),
  async (ctx: Context) => {
    const filters = ctx.req.valid("query" as never) as z.infer<
      typeof sharedAgentFiltersSchema
    >;

    const repo = new SharedAgentRepository(ctx.env);
    const agents = await repo.getSharedAgents({
      category: filters.category,
      tags: filters.tags,
      search: filters.search,
      featured: filters.featured,
      limit: filters.limit,
      offset: filters.offset,
      sortBy: filters.sort_by,
    });

    return ctx.json({
      status: "success",
      data: agents,
    });
  },
);

app.get(
  "/featured",
  describeRoute({
    tags: ["shared-agents"],
    summary: "Get a list of featured agents",
    description: "Get a list of featured agents",
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
  zValidator("query", featuredAgentsSchema),
  async (ctx: Context) => {
    const { limit } = ctx.req.valid("query" as never) as z.infer<
      typeof featuredAgentsSchema
    >;

    const repo = new SharedAgentRepository(ctx.env);
    const agents = await repo.getFeaturedAgents(limit);

    return ctx.json({
      status: "success",
      data: agents,
    });
  },
);

app.get(
  "/categories",
  describeRoute({
    tags: ["shared-agents"],
    summary: "Get a list of agent categories",
    description: "Get a list of all available agent categories",
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
    const categories = await repo.getCategories();

    return ctx.json({
      status: "success",
      data: categories,
    });
  },
);

app.get(
  "/tags",
  describeRoute({
    tags: ["shared-agents"],
    summary: "Get a list of popular tags",
    description: "Get a list of popular agent tags",
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
    const tags = await repo.getPopularTags();

    return ctx.json({
      status: "success",
      data: tags,
    });
  },
);

app.get(
  "/:id",
  describeRoute({
    tags: ["shared-agents"],
    summary: "Get a shared agent by ID",
    description: "Get details of a specific shared agent",
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
    const { id } = ctx.req.param();

    const repo = new SharedAgentRepository(ctx.env);
    const agent = await repo.getSharedAgentById(id);

    if (!agent) {
      return ctx.json(
        {
          status: "error",
          error: "Shared agent not found",
        },
        404,
      );
    }

    return ctx.json({
      status: "success",
      data: agent,
    });
  },
);

app.post(
  "/:id/install",
  requireAuth,
  describeRoute({
    tags: ["shared-agents"],
    summary: "Install shared agent",
    description: "Install a shared agent as a template into your account",
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
    const { id } = ctx.req.param();
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new SharedAgentRepository(ctx.env);

    try {
      const result = await repo.installAgent(user.id, id);

      return ctx.json({
        status: "success",
        data: result,
      });
    } catch (error) {
      return ctx.json(
        {
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to install agent",
        },
        400,
      );
    }
  },
);

app.post(
  "/:id/rate",
  requireAuth,
  describeRoute({
    tags: ["shared-agents"],
    summary: "Rate shared agent",
    description: "Rate and review a shared agent",
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
  zValidator("json", rateAgentSchema),
  async (ctx: Context) => {
    const { id } = ctx.req.param();
    const body = ctx.req.valid("json" as never) as z.infer<
      typeof rateAgentSchema
    >;
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new SharedAgentRepository(ctx.env);

    try {
      const rating = await repo.rateAgent(
        user.id,
        id,
        body.rating,
        body.review,
      );

      return ctx.json({
        status: "success",
        data: rating,
      });
    } catch (error) {
      return ctx.json(
        {
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to rate agent",
        },
        400,
      );
    }
  },
);

app.get(
  "/:id/ratings",
  describeRoute({
    tags: ["shared-agents"],
    summary: "Get agent ratings",
    description: "Get ratings and reviews for a shared agent",
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
  zValidator("query", agentRatingsSchema),
  async (ctx: Context) => {
    const { id } = ctx.req.param();
    const { limit } = ctx.req.valid("query" as never) as z.infer<
      typeof agentRatingsSchema
    >;

    const repo = new SharedAgentRepository(ctx.env);
    const ratings = await repo.getAgentRatings(id, limit);

    return ctx.json({
      status: "success",
      data: ratings,
    });
  },
);

app.get(
  "/check/:agentId",
  requireAuth,
  describeRoute({
    tags: ["shared-agents"],
    summary: "Check if agent is shared",
    description:
      "Check if a specific agent is already shared to the marketplace",
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
    const { agentId } = ctx.req.param();
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new SharedAgentRepository(ctx.env);
    const sharedAgent = await repo.getSharedAgentByAgentId(agentId);

    return ctx.json({
      status: "success",
      data: {
        isShared: !!sharedAgent,
        sharedAgent: sharedAgent || null,
      },
    });
  },
);

app.post(
  "/share",
  requireAuth,
  describeRoute({
    tags: ["shared-agents"],
    summary: "Share an agent",
    description: "Share one of your agents",
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
  zValidator("json", shareAgentSchema),
  async (ctx: Context) => {
    const body = ctx.req.valid("json" as never) as z.infer<
      typeof shareAgentSchema
    >;
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new SharedAgentRepository(ctx.env);

    try {
      const sharedAgent = await repo.shareAgent(user.id, {
        agentId: body.agent_id,
        name: body.name,
        description: body.description,
        avatarUrl: body.avatar_url,
        category: body.category,
        tags: body.tags,
      });

      return ctx.json({
        status: "success",
        data: sharedAgent,
      });
    } catch (error) {
      return ctx.json(
        {
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to share agent",
        },
        400,
      );
    }
  },
);

app.put(
  "/:id",
  requireAuth,
  describeRoute({
    tags: ["shared-agents"],
    summary: "Update shared agent",
    description: "Update your shared agent details",
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
  zValidator("json", updateSharedAgentSchema),
  async (ctx: Context) => {
    const { id } = ctx.req.param();
    const body = ctx.req.valid("json" as never) as z.infer<
      typeof updateSharedAgentSchema
    >;
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new SharedAgentRepository(ctx.env);

    try {
      await repo.updateSharedAgent(user.id, id, body);

      return ctx.json({
        status: "success",
      });
    } catch (error) {
      return ctx.json(
        {
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to update shared agent",
        },
        400,
      );
    }
  },
);

app.delete(
  "/:id",
  requireAuth,
  describeRoute({
    tags: ["shared-agents"],
    summary: "Delete shared agent",
    description: "Remove your agent from the marketplace",
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
    const { id } = ctx.req.param();
    const user = ctx.get("user");

    if (!user?.id) {
      return ctx.json(
        {
          status: "error",
          error: "Unauthorized",
        },
        401,
      );
    }

    const repo = new SharedAgentRepository(ctx.env);

    try {
      await repo.deleteSharedAgent(user.id, id);

      return ctx.json({
        status: "success",
      });
    } catch (error) {
      return ctx.json(
        {
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete shared agent",
        },
        400,
      );
    }
  },
);

export default app;
