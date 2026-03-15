import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import {
	setAgentFeaturedSchema,
	moderateAgentSchema,
	apiResponseSchema,
} from "@assistant/schemas";

import { requireAdmin, requireStrictAdmin } from "~/middleware/adminMiddleware";
import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
	setAgentFeaturedStatus,
	moderateAgent,
	getAllSharedAgentsForAdmin,
} from "~/services/admin/sharedAgents";
import type { IEnv } from "~/types";
import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("admin");

app.use("/*", async (ctx, next) => {
	logger.info(`Processing admin route: ${ctx.req.method} ${ctx.req.path}`);
	return next();
});

addRoute(app, "put", "/shared-agents/:id/featured", {
	tags: ["admin"],
	summary: "Set agent featured status",
	description: "Mark an agent as featured or unfeatured (admin only)",
	bodySchema: setAgentFeaturedSchema,
	responses: {
		"200": { description: "Success", schema: apiResponseSchema },
	},
	middleware: [requireAuth, requireStrictAdmin],
	handler: async ({ raw }) =>
		(async (ctx: Context) => {
			const { id } = ctx.req.param();
			const { featured } = ctx.req.valid("json" as never) as {
				featured: boolean;
			};

			const currentUser = ctx.get("user");

			const serviceContext = getServiceContext(ctx);

			const result = await setAgentFeaturedStatus({
				context: serviceContext,
				env: ctx.env,
				agentId: id,
				featured,
				moderator: currentUser,
			});

			if (!result.success) {
				return ResponseFactory.error(
					ctx,
					result.error || "Failed to set featured status",
					400,
				);
			}

			return ResponseFactory.success(ctx, result.data);
		})(raw),
});

addRoute(app, "get", "/shared-agents", {
	tags: ["admin"],
	summary: "Get all shared agents for admin review",
	description: "Get all shared agents including non-public ones (admin only)",
	responses: {
		"200": { description: "Success", schema: apiResponseSchema },
	},
	middleware: [requireAuth, requireAdmin],
	handler: async ({ raw }) =>
		(async (ctx: Context) => {
			const agents = await getAllSharedAgentsForAdmin(ctx.env);

			return ResponseFactory.success(ctx, agents);
		})(raw),
});

addRoute(app, "put", "/shared-agents/:id/moderate", {
	tags: ["admin"],
	summary: "Moderate shared agent",
	description: "Approve or reject a shared agent (admin only)",
	bodySchema: moderateAgentSchema,
	responses: {
		"200": { description: "Success", schema: apiResponseSchema },
	},
	middleware: [requireAuth, requireAdmin],
	handler: async ({ raw }) =>
		(async (ctx: Context) => {
			const { id } = ctx.req.param();
			const { is_public, reason } = ctx.req.valid("json" as never) as {
				is_public: boolean;
				reason: string;
			};

			const currentUser = ctx.get("user");

			const serviceContext = getServiceContext(ctx);

			const result = await moderateAgent({
				context: serviceContext,
				env: ctx.env,
				agentId: id,
				isPublic: is_public,
				reason,
				moderator: currentUser,
			});

			if (!result.success) {
				return ResponseFactory.error(
					ctx,
					result.error || "Failed to moderate agent",
					400,
				);
			}

			return ResponseFactory.success(ctx, result.data);
		})(raw),
});

export default app;
