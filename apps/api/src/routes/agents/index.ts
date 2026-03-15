import { Hono } from "hono";
import z from "zod/v4";
import {
	createAgentSchema,
	updateAgentSchema,
	createChatCompletionsJsonSchema,
	apiResponseSchema,
} from "@assistant/schemas";

import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import {
	getUserAgents,
	getUserTeamAgents,
	getAgentsByTeam,
	getAgentById,
	createAgent,
	updateAgent,
	deleteAgent,
	getAgentServers,
	createAgentCompletion,
} from "~/services/agents";
import type { IEnv } from "~/types";
import sharedAgents from "./shared";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("agents");

app.use("/*", async (ctx, next) => {
	logger.info(`Processing agents route: ${ctx.req.method} ${ctx.req.path}`);
	return next();
});

const agentIdParamSchema = z.object({ agentId: z.string().min(1) });
const teamIdParamSchema = z.object({ teamId: z.string().min(1) });

addRoute(app, "get", "/", {
	tags: ["agents"],
	summary: "Get all agents",
	description: "Get all agents for the current user",
	auth: true,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext }) => {
		return getUserAgents(serviceContext);
	},
});

addRoute(app, "post", "/", {
	tags: ["agents"],
	summary: "Create an agent",
	description: "Create an agent for the current user",
	auth: true,
	bodySchema: createAgentSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, body }) => {
		return createAgent(serviceContext, {
			name: body.name,
			description: body.description ?? "",
			avatar_url: body.avatar_url ?? null,
			servers: body.servers ?? [],
			model: body.model,
			temperature: body.temperature,
			max_steps: body.max_steps,
			system_prompt: body.system_prompt,
			few_shot_examples: body.few_shot_examples,
			enabled_tools: body.enabled_tools,
			team_id: body.team_id,
			team_role: body.team_role,
			is_team_agent: body.is_team_agent,
		});
	},
});

addRoute(app, "get", "/teams", {
	tags: ["agents"],
	summary: "Get team agents",
	description: "Get all team agents for the current user",
	auth: true,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext }) => {
		return getUserTeamAgents(serviceContext);
	},
});

addRoute(app, "get", "/teams/:teamId", {
	tags: ["agents"],
	summary: "Get agents by team ID",
	description:
		"Get all agents belonging to a specific team for the current user",
	auth: true,
	paramSchema: teamIdParamSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params }) => {
		return getAgentsByTeam(serviceContext, params.teamId);
	},
});

app.route("/shared", sharedAgents);

addRoute(app, "get", "/:agentId", {
	tags: ["agents"],
	summary: "Get an agent by ID",
	auth: true,
	paramSchema: agentIdParamSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params }) => {
		return getAgentById(serviceContext, params.agentId);
	},
});

addRoute(app, "get", "/:agentId/servers", {
	tags: ["agents"],
	summary: "Get servers for an agent",
	auth: true,
	paramSchema: agentIdParamSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params }) => {
		return getAgentServers(serviceContext, params.agentId);
	},
});

addRoute(app, "put", "/:agentId", {
	tags: ["agents"],
	summary: "Update an agent",
	auth: true,
	paramSchema: agentIdParamSchema,
	bodySchema: updateAgentSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params, body }) => {
		return updateAgent(serviceContext, params.agentId, body);
	},
});

addRoute(app, "delete", "/:agentId", {
	tags: ["agents"],
	summary: "Delete an agent",
	auth: true,
	paramSchema: agentIdParamSchema,
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({ serviceContext, params }) => {
		await deleteAgent(serviceContext, params.agentId);
		return { message: "Agent deleted successfully" };
	},
});

addRoute(app, "post", "/:agentId/completions", {
	tags: ["agents"],
	summary: "Create agent completion",
	description: "Run a chat completion against a specific agent",
	paramSchema: agentIdParamSchema,
	bodySchema: createChatCompletionsJsonSchema,
	middleware: [validateCaptcha],
	responses: { 200: { description: "Success", schema: apiResponseSchema } },
	handler: async ({
		serviceContext,
		raw,
		params,
		body,
		user,
		anonymousUser,
	}) => {
		if (!user && !anonymousUser) {
			return ResponseFactory.error(raw, "Unauthorized", 401);
		}

		return createAgentCompletion({
			env: raw.env,
			context: serviceContext,
			body,
			agentId: params.agentId,
			user,
			anonymousUser,
		});
	},
});

export default app;
