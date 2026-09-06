import {
  apiResponseSchema,
  teammateRatingsSchema,
  featuredTeammatesSchema,
  rateTeammateSchema,
  shareTeammateSchema,
  sharedTeammateFiltersSchema,
  updateSharedTeammateSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import * as z from "zod/v4";

import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import { requireStrictAdmin } from "~/middleware/adminMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  deleteSharedTeammate,
  getFeaturedTeammates,
  getSharedTeammateByTeammateId,
  getSharedTeammateById,
  getSharedTeammateCategories,
  getSharedTeammatePopularTags,
  getSharedTeammateRatings,
  getSharedTeammates,
  installSharedTeammate,
  moderateSharedTeammate,
  rateSharedTeammate,
  setFeaturedStatus,
  shareTeammate,
  uninstallSharedTeammate,
  updateSharedTeammate,
} from "~/services/teammates/shared";
import type { IEnv } from "~/types";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("agents/shared");

const sharedTeammateIdParamSchema = z.object({ id: z.string().min(1) });
const teammateIdParamSchema = z.object({ teammateId: z.string().min(1) });
const setFeaturedBodySchema = z.object({ featured: z.boolean() });
const moderateBodySchema = z.object({ is_public: z.boolean() });

app.use("/*", async (ctx, next) => {
  logger.info(`Processing shared agents route: ${ctx.req.method} ${ctx.req.path}`);

  return next();
});

addRoute(app, "get", "/", {
  tags: ["shared-agents"],
  summary: "Get a list of shared agents",
  description: "Get a list of shared agents with optional filtering and sorting",
  querySchema: sharedTeammateFiltersSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, query }) => {
    return getSharedTeammates(serviceContext, {
      category: query.category,
      tags: query.tags,
      search: query.search,
      featured: query.featured,
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sort_by,
    });
  },
});

addRoute(app, "get", "/featured", {
  tags: ["shared-agents"],
  summary: "Get a list of featured agents",
  description: "Get a list of featured agents",
  querySchema: featuredTeammatesSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, query }) => {
    return getFeaturedTeammates(serviceContext, query.limit);
  },
});

addRoute(app, "get", "/categories", {
  tags: ["shared-agents"],
  summary: "Get a list of agent categories",
  description: "Get a list of all available agent categories",
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext }) => {
    return getSharedTeammateCategories(serviceContext);
  },
});

addRoute(app, "get", "/tags", {
  tags: ["shared-agents"],
  summary: "Get a list of popular tags",
  description: "Get a list of popular agent tags",
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext }) => {
    return getSharedTeammatePopularTags(serviceContext);
  },
});

addRoute(app, "get", "/:id", {
  tags: ["shared-agents"],
  summary: "Get a shared agent by ID",
  description: "Get details of a specific shared agent",
  paramSchema: sharedTeammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, raw }) => {
    const agent = await getSharedTeammateById(serviceContext, params.id);

    if (!agent) {
      return ResponseFactory.error(raw, "Shared agent not found", 404);
    }

    return agent;
  },
});

addRoute(app, "post", "/:id/install", {
  tags: ["shared-agents"],
  summary: "Install shared agent",
  description: "Install a shared agent as a template into your account",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, user }) => {
    return installSharedTeammate(serviceContext, params.id, user.id);
  },
});

addRoute(app, "post", "/:id/uninstall", {
  tags: ["shared-agents"],
  summary: "Uninstall shared agent",
  description: "Remove a shared agent template from your account",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, user }) => {
    await uninstallSharedTeammate(serviceContext, params.id, user.id);

    return {
      message: "Agent uninstalled successfully",
    };
  },
});

addRoute(app, "post", "/:id/rate", {
  tags: ["shared-agents"],
  summary: "Rate shared agent",
  description: "Rate and review a shared agent",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  bodySchema: rateTeammateSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, body, user }) => {
    return rateSharedTeammate(serviceContext, params.id, body.rating, body.review, user.id);
  },
});

addRoute(app, "get", "/:id/ratings", {
  tags: ["shared-agents"],
  summary: "Get agent ratings",
  description: "Get ratings and reviews for a shared agent",
  paramSchema: sharedTeammateIdParamSchema,
  querySchema: teammateRatingsSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, query }) => {
    return getSharedTeammateRatings(serviceContext, params.id, query.limit);
  },
});

addRoute(app, "get", "/check/:teammateId", {
  tags: ["shared-agents"],
  summary: "Check if agent is shared",
  description: "Check if a specific agent is already shared to the marketplace",
  auth: true,
  paramSchema: teammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    const sharedAgent = await getSharedTeammateByTeammateId(serviceContext, params.teammateId);

    return {
      isShared: !!sharedAgent,
      sharedAgent: sharedAgent || null,
    };
  },
});

addRoute(app, "post", "/share", {
  tags: ["shared-agents"],
  summary: "Share an agent",
  description: "Share one of your agents",
  auth: true,
  bodySchema: shareTeammateSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, body, user }) => {
    return shareTeammate(
      serviceContext,
      {
        teammateId: body.agent_id,
        name: body.name,
        description: body.description,
        avatarUrl: body.avatar_url,
        category: body.category,
        tags: body.tags,
      },
      user.id,
    );
  },
});

addRoute(app, "put", "/:id", {
  tags: ["shared-agents"],
  summary: "Update shared agent",
  description: "Update your shared agent details",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  bodySchema: updateSharedTeammateSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, body, user }) => {
    await updateSharedTeammate(serviceContext, params.id, body, user.id);

    return {
      message: "Shared agent updated successfully",
    };
  },
});

addRoute(app, "delete", "/:id", {
  tags: ["shared-agents"],
  summary: "Delete shared agent",
  description: "Remove your agent from the marketplace",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, user }) => {
    await deleteSharedTeammate(serviceContext, params.id, user.id);

    return {
      message: "Shared agent deleted successfully",
    };
  },
});

addRoute(app, "post", "/:id/featured", {
  tags: ["shared-agents"],
  summary: "Set featured status",
  description: "Toggle the featured status for a shared agent",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  bodySchema: setFeaturedBodySchema,
  middleware: [requireStrictAdmin],
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, body }) => {
    await setFeaturedStatus(serviceContext, params.id, body.featured);

    return {
      message: "Featured status updated successfully",
    };
  },
});

addRoute(app, "post", "/:id/moderate", {
  tags: ["shared-agents"],
  summary: "Moderate shared agent",
  description: "Approve or reject a shared agent listing",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  bodySchema: moderateBodySchema,
  middleware: [requireStrictAdmin],
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, body }) => {
    await moderateSharedTeammate(serviceContext, params.id, body.is_public);

    return {
      message: "Shared agent moderated successfully",
    };
  },
});

export default app;
