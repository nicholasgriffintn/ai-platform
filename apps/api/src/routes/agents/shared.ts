import { Hono } from "hono";
import * as z from "zod/v4";
import {
	apiResponseSchema,
	agentRatingsSchema,
	featuredAgentsSchema,
	rateAgentSchema,
	shareAgentSchema,
	sharedAgentFiltersSchema,
	updateSharedAgentSchema,
} from "@assistant/schemas";

import { requireStrictAdmin } from "~/middleware/adminMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
	deleteSharedAgent,
	getFeaturedAgents,
	getSharedAgentByAgentId,
	getSharedAgentById,
	getSharedAgentCategories,
	getSharedAgentPopularTags,
	getSharedAgentRatings,
	getSharedAgents,
	installSharedAgent,
	moderateSharedAgent,
	rateSharedAgent,
	setFeaturedStatus,
	shareAgent,
	uninstallSharedAgent,
	updateSharedAgent,
} from "~/services/agents/shared";
import type { IEnv } from "~/types";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("agents/shared");

const sharedAgentIdParamSchema = z.object({ id: z.string().min(1) });
const agentIdParamSchema = z.object({ agentId: z.string().min(1) });
const setFeaturedBodySchema = z.object({ featured: z.boolean() });
const moderateBodySchema = z.object({ is_public: z.boolean() });

app.use("/*", async (ctx, next) => {
	logger.info(
		`Processing shared agents route: ${ctx.req.method} ${ctx.req.path}`,
	);
	return next();
});

addRoute(app, "get", "/", {
	tags: ["shared-agents"],
	summary: "Get a list of shared agents",
	description:
		"Get a list of shared agents with optional filtering and sorting",
	querySchema: sharedAgentFiltersSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, query }) => {
		return getSharedAgents(serviceContext, {
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
	querySchema: featuredAgentsSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, query }) => {
		return getFeaturedAgents(serviceContext, query.limit);
	},
});

addRoute(app, "get", "/categories", {
	tags: ["shared-agents"],
	summary: "Get a list of agent categories",
	description: "Get a list of all available agent categories",
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext }) => {
		return getSharedAgentCategories(serviceContext);
	},
});

addRoute(app, "get", "/tags", {
	tags: ["shared-agents"],
	summary: "Get a list of popular tags",
	description: "Get a list of popular agent tags",
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext }) => {
		return getSharedAgentPopularTags(serviceContext);
	},
});

addRoute(app, "get", "/:id", {
	tags: ["shared-agents"],
	summary: "Get a shared agent by ID",
	description: "Get details of a specific shared agent",
	paramSchema: sharedAgentIdParamSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params, raw }) => {
		const agent = await getSharedAgentById(serviceContext, params.id);

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
	paramSchema: sharedAgentIdParamSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params, user }) => {
		return installSharedAgent(serviceContext, params.id, user.id);
	},
});

addRoute(app, "post", "/:id/uninstall", {
	tags: ["shared-agents"],
	summary: "Uninstall shared agent",
	description: "Remove a shared agent template from your account",
	auth: true,
	paramSchema: sharedAgentIdParamSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params, user }) => {
		await uninstallSharedAgent(serviceContext, params.id, user.id);

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
	paramSchema: sharedAgentIdParamSchema,
	bodySchema: rateAgentSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params, body, user }) => {
		return rateSharedAgent(
			serviceContext,
			params.id,
			body.rating,
			body.review,
			user.id,
		);
	},
});

addRoute(app, "get", "/:id/ratings", {
	tags: ["shared-agents"],
	summary: "Get agent ratings",
	description: "Get ratings and reviews for a shared agent",
	paramSchema: sharedAgentIdParamSchema,
	querySchema: agentRatingsSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params, query }) => {
		return getSharedAgentRatings(serviceContext, params.id, query.limit);
	},
});

addRoute(app, "get", "/check/:agentId", {
	tags: ["shared-agents"],
	summary: "Check if agent is shared",
	description: "Check if a specific agent is already shared to the marketplace",
	auth: true,
	paramSchema: agentIdParamSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params }) => {
		const sharedAgent = await getSharedAgentByAgentId(
			serviceContext,
			params.agentId,
		);

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
	bodySchema: shareAgentSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, body, user }) => {
		return shareAgent(
			serviceContext,
			{
				agentId: body.agent_id,
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
	paramSchema: sharedAgentIdParamSchema,
	bodySchema: updateSharedAgentSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params, body, user }) => {
		await updateSharedAgent(serviceContext, params.id, body, user.id);

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
	paramSchema: sharedAgentIdParamSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params, user }) => {
		await deleteSharedAgent(serviceContext, params.id, user.id);

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
	paramSchema: sharedAgentIdParamSchema,
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
	paramSchema: sharedAgentIdParamSchema,
	bodySchema: moderateBodySchema,
	middleware: [requireStrictAdmin],
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params, body }) => {
		await moderateSharedAgent(serviceContext, params.id, body.is_public);

		return {
			message: "Shared agent moderated successfully",
		};
	},
});

export default app;
