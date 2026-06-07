import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";
import { z } from "zod/v4";

import { setAgentFeaturedSchema, moderateAgentSchema, apiResponseSchema } from "@assistant/schemas";

import { requireAdmin, requireStrictAdmin } from "~/middleware/adminMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
	setAgentFeaturedStatus,
	moderateAgent,
	getAllSharedAgentsForAdmin,
} from "~/services/admin/sharedAgents";
import type { IEnv } from "~/types";
import { ResponseFactory } from "~/lib/http/ResponseFactory";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("admin");

app.use("/*", async (ctx, next) => {
	logger.info(`Processing admin route: ${ctx.req.method} ${ctx.req.path}`);
	return next();
});

const sharedAgentParamsSchema = z.object({
	id: z.string().min(1),
});

addRoute(app, "put", "/shared-agents/:id/featured", {
	tags: ["admin"],
	summary: "Set agent featured status",
	description: "Mark an agent as featured or unfeatured (admin only)",
	bodySchema: setAgentFeaturedSchema,
	paramSchema: sharedAgentParamsSchema,
	auth: true,
	responses: {
		"200": { description: "Success", schema: apiResponseSchema },
	},
	middleware: [requireStrictAdmin],
	handler: async ({ body, params, raw, serviceContext, user }) => {
		const result = await setAgentFeaturedStatus({
			context: serviceContext,
			env: serviceContext.env,
			agentId: params.id,
			featured: body.featured,
			moderator: user,
		});

		if (!result.success) {
			return ResponseFactory.error(raw, result.error || "Failed to set featured status", 400);
		}

		return result.data;
	},
});

addRoute(app, "get", "/shared-agents", {
	tags: ["admin"],
	summary: "Get all shared agents for admin review",
	description: "Get all shared agents including non-public ones (admin only)",
	responses: {
		"200": { description: "Success", schema: apiResponseSchema },
	},
	auth: true,
	middleware: [requireAdmin],
	handler: async ({ serviceContext }) => getAllSharedAgentsForAdmin({ context: serviceContext }),
});

addRoute(app, "put", "/shared-agents/:id/moderate", {
	tags: ["admin"],
	summary: "Moderate shared agent",
	description: "Approve or reject a shared agent (admin only)",
	bodySchema: moderateAgentSchema,
	paramSchema: sharedAgentParamsSchema,
	auth: true,
	responses: {
		"200": { description: "Success", schema: apiResponseSchema },
	},
	middleware: [requireAdmin],
	handler: async ({ body, params, raw, serviceContext, user }) => {
		const result = await moderateAgent({
			context: serviceContext,
			env: serviceContext.env,
			agentId: params.id,
			isPublic: body.is_public,
			reason: body.reason,
			moderator: user,
		});

		if (!result.success) {
			return ResponseFactory.error(raw, result.error || "Failed to moderate agent", 400);
		}

		return result.data;
	},
});

export default app;
