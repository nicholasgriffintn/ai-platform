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
const logger = createRouteLogger("teammates/shared");

const sharedTeammateIdParamSchema = z.object({ id: z.string().min(1) });
const teammateIdParamSchema = z.object({ teammateId: z.string().min(1) });
const setFeaturedBodySchema = z.object({ featured: z.boolean() });
const moderateBodySchema = z.object({ is_public: z.boolean() });

app.use("/*", async (ctx, next) => {
  logger.info(`Processing shared teammates route: ${ctx.req.method} ${ctx.req.path}`);

  return next();
});

addRoute(app, "get", "/", {
  tags: ["shared-teammates"],
  summary: "Get a list of shared teammates",
  description: "Get a list of shared teammates with optional filtering and sorting",
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
  tags: ["shared-teammates"],
  summary: "Get a list of featured teammates",
  description: "Get a list of featured teammates",
  querySchema: featuredTeammatesSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, query }) => {
    return getFeaturedTeammates(serviceContext, query.limit);
  },
});

addRoute(app, "get", "/categories", {
  tags: ["shared-teammates"],
  summary: "Get a list of teammate categories",
  description: "Get a list of all available teammate categories",
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext }) => {
    return getSharedTeammateCategories(serviceContext);
  },
});

addRoute(app, "get", "/tags", {
  tags: ["shared-teammates"],
  summary: "Get a list of popular tags",
  description: "Get a list of popular teammate tags",
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext }) => {
    return getSharedTeammatePopularTags(serviceContext);
  },
});

addRoute(app, "get", "/:id", {
  tags: ["shared-teammates"],
  summary: "Get a shared teammate by ID",
  description: "Get details of a specific shared teammate",
  paramSchema: sharedTeammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, raw }) => {
    const teammate = await getSharedTeammateById(serviceContext, params.id);

    if (!teammate) {
      return ResponseFactory.error(raw, "Shared teammate not found", 404);
    }

    return teammate;
  },
});

addRoute(app, "post", "/:id/install", {
  tags: ["shared-teammates"],
  summary: "Install shared teammate",
  description: "Install a shared teammate as a template into your account",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, user }) => {
    return installSharedTeammate(serviceContext, params.id, user.id);
  },
});

addRoute(app, "post", "/:id/uninstall", {
  tags: ["shared-teammates"],
  summary: "Uninstall shared teammate",
  description: "Remove a shared teammate template from your account",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, user }) => {
    await uninstallSharedTeammate(serviceContext, params.id, user.id);

    return {
      message: "Teammate uninstalled successfully",
    };
  },
});

addRoute(app, "post", "/:id/rate", {
  tags: ["shared-teammates"],
  summary: "Rate shared teammate",
  description: "Rate and review a shared teammate",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  bodySchema: rateTeammateSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, body, user }) => {
    return rateSharedTeammate(serviceContext, params.id, body.rating, body.review, user.id);
  },
});

addRoute(app, "get", "/:id/ratings", {
  tags: ["shared-teammates"],
  summary: "Get teammate ratings",
  description: "Get ratings and reviews for a shared teammate",
  paramSchema: sharedTeammateIdParamSchema,
  querySchema: teammateRatingsSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, query }) => {
    return getSharedTeammateRatings(serviceContext, params.id, query.limit);
  },
});

addRoute(app, "get", "/check/:teammateId", {
  tags: ["shared-teammates"],
  summary: "Check if teammate is shared",
  description: "Check if a specific teammate is already shared to the marketplace",
  auth: true,
  paramSchema: teammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    const sharedTeammate = await getSharedTeammateByTeammateId(serviceContext, params.teammateId);

    return {
      isShared: !!sharedTeammate,
      sharedTeammate: sharedTeammate || null,
    };
  },
});

addRoute(app, "post", "/share", {
  tags: ["shared-teammates"],
  summary: "Share an teammate",
  description: "Share one of your teammates",
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
  tags: ["shared-teammates"],
  summary: "Update shared teammate",
  description: "Update your shared teammate details",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  bodySchema: updateSharedTeammateSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, body, user }) => {
    await updateSharedTeammate(serviceContext, params.id, body, user.id);

    return {
      message: "Shared teammate updated successfully",
    };
  },
});

addRoute(app, "delete", "/:id", {
  tags: ["shared-teammates"],
  summary: "Delete shared teammate",
  description: "Remove your teammate from the marketplace",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, user }) => {
    await deleteSharedTeammate(serviceContext, params.id, user.id);

    return {
      message: "Shared teammate deleted successfully",
    };
  },
});

addRoute(app, "post", "/:id/featured", {
  tags: ["shared-teammates"],
  summary: "Set featured status",
  description: "Toggle the featured status for a shared teammate",
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
  tags: ["shared-teammates"],
  summary: "Moderate shared teammate",
  description: "Approve or reject a shared teammate listing",
  auth: true,
  paramSchema: sharedTeammateIdParamSchema,
  bodySchema: moderateBodySchema,
  middleware: [requireStrictAdmin],
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params, body }) => {
    await moderateSharedTeammate(serviceContext, params.id, body.is_public);

    return {
      message: "Shared teammate moderated successfully",
    };
  },
});

export default app;
