import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
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

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuth } from "~/middleware/auth";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
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

		const serviceContext = getServiceContext(ctx);
		const agents = await getSharedAgents(serviceContext, {
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
		const serviceContext = getServiceContext(ctx);
		const agents = await getFeaturedAgents(serviceContext, limit);

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
		const serviceContext = getServiceContext(ctx);
		const categories = await getSharedAgentCategories(serviceContext);

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
		const serviceContext = getServiceContext(ctx);
		const tags = await getSharedAgentPopularTags(serviceContext);

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
		const serviceContext = getServiceContext(ctx);

		const agent = await getSharedAgentById(serviceContext, id);

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

		try {
			const serviceContext = getServiceContext(ctx);
			const result = await installSharedAgent(serviceContext, id, user.id);

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
	"/:id/uninstall",
	requireAuth,
	describeRoute({
		tags: ["shared-agents"],
		summary: "Uninstall shared agent",
		description: "Remove a shared agent template from your account",
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

		const serviceContext = getServiceContext(ctx);
		await uninstallSharedAgent(serviceContext, id, user.id);

		return ctx.json({
			status: "success",
		});
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

		try {
			const serviceContext = getServiceContext(ctx);
			const rating = await rateSharedAgent(
				serviceContext,
				id,
				body.rating,
				body.review,
				user.id,
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
		const serviceContext = getServiceContext(ctx);
		const ratings = await getSharedAgentRatings(serviceContext, id, limit);

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

		const serviceContext = getServiceContext(ctx);
		const sharedAgent = await getSharedAgentByAgentId(serviceContext, agentId);

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

		try {
			const serviceContext = getServiceContext(ctx);
			const sharedAgent = await shareAgent(
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

		try {
			const serviceContext = getServiceContext(ctx);
			await updateSharedAgent(serviceContext, id, body, user.id);

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

		try {
			const serviceContext = getServiceContext(ctx);
			await deleteSharedAgent(serviceContext, id, user.id);

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

app.post(
	"/:id/featured",
	requireAuth,
	describeRoute({
		tags: ["shared-agents"],
		summary: "Set featured status",
		description: "Toggle the featured status for a shared agent",
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
	zValidator(
		"json",
		z.object({
			featured: z.boolean(),
		}),
	),
	async (ctx: Context) => {
		const { id } = ctx.req.param();
		const { featured } = ctx.req.valid("json" as never) as {
			featured: boolean;
		};

		const serviceContext = getServiceContext(ctx);
		await setFeaturedStatus(serviceContext, id, featured);

		return ctx.json({
			status: "success",
		});
	},
);

app.post(
	"/:id/moderate",
	requireAuth,
	describeRoute({
		tags: ["shared-agents"],
		summary: "Moderate shared agent",
		description: "Approve or reject a shared agent listing",
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
	zValidator(
		"json",
		z.object({
			is_public: z.boolean(),
		}),
	),
	async (ctx: Context) => {
		const { id } = ctx.req.param();
		const { is_public } = ctx.req.valid("json" as never) as {
			is_public: boolean;
		};

		const serviceContext = getServiceContext(ctx);
		await moderateSharedAgent(serviceContext, id, is_public);

		return ctx.json({
			status: "success",
		});
	},
);

export default app;
