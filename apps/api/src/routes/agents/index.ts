import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import type z from "zod/v4";
import {
	createAgentSchema,
	updateAgentSchema,
	createChatCompletionsJsonSchema,
	apiResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuth } from "~/middleware/auth";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
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
import type { ChatCompletionParameters, IEnv } from "~/types";
import sharedAgents from "./shared";

const app = new Hono<{ Bindings: IEnv }>();
const logger = createRouteLogger("agents");

app.use("/*", async (ctx, next) => {
	logger.info(`Processing agents route: ${ctx.req.method} ${ctx.req.path}`);
	return next();
});

app.get(
	"/",
	describeRoute({
		tags: ["agents"],
		summary: "Get all agents",
		description: "Get all agents for the current user",
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
		const user = ctx.get("user");

		if (!user?.id) {
			return ctx.json({
				status: "success",
				data: [],
			});
		}

		const serviceContext = getServiceContext(ctx);
		const agents = await getUserAgents(serviceContext);

		return ctx.json({
			status: "success",
			data: agents,
		});
	},
);

app.post(
	"/",
	requireAuth,
	describeRoute({
		tags: ["agents"],
		summary: "Create an agent",
		description: "Create an agent for the current user",
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
	zValidator("json", createAgentSchema),
	async (ctx: Context) => {
		const body = ctx.req.valid("json" as never) as z.infer<
			typeof createAgentSchema
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

		const serviceContext = getServiceContext(ctx);
		const agent = await createAgent(serviceContext, {
			name: body.name,
			description: body.description ?? "",
			avatar_url: body.avatar_url ?? null,
			servers: body.servers ?? [],
			model: body.model,
			temperature: body.temperature,
			max_steps: body.max_steps,
			system_prompt: body.system_prompt,
			few_shot_examples: body.few_shot_examples,
			team_id: body.team_id,
			team_role: body.team_role,
			is_team_agent: body.is_team_agent,
		});

		return ctx.json({
			status: "success",
			data: agent,
		});
	},
);

app.get(
	"/teams",
	requireAuth,
	describeRoute({
		tags: ["agents"],
		summary: "Get team agents",
		description: "Get all team agents for the current user",
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
		const agents = await getUserTeamAgents(serviceContext);

		return ctx.json({
			status: "success",
			data: agents,
		});
	},
);

app.get(
	"/teams/:teamId",
	requireAuth,
	describeRoute({
		tags: ["agents"],
		summary: "Get agents by team ID",
		description:
			"Get all agents belonging to a specific team for the current user",
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
		const { teamId } = ctx.req.param();
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
		const agents = await getAgentsByTeam(serviceContext, teamId);

		return ctx.json({
			status: "success",
			data: agents,
		});
	},
);

app.route("/shared", sharedAgents);

app.get(
	"/:agentId",
	requireAuth,
	describeRoute({
		tags: ["agents"],
		summary: "Get an agent by ID",
		description: "Get an agent by ID",
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
		const agent = await getAgentById(serviceContext, agentId);

		return ctx.json({
			status: "success",
			data: agent,
		});
	},
);

app.get(
	"/:agentId/servers",
	requireAuth,
	describeRoute({
		tags: ["agents"],
		summary: "Get servers for an agent",
		description: "Get servers for an agent",
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
		const serverDetails = await getAgentServers(serviceContext, agentId);

		return ctx.json({
			status: "success",
			data: serverDetails,
		});
	},
);

app.put(
	"/:agentId",
	requireAuth,
	describeRoute({
		tags: ["agents"],
		summary: "Update an agent",
		description: "Update an agent",
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
	zValidator("json", updateAgentSchema),
	async (ctx: Context) => {
		const { agentId } = ctx.req.param();
		const body = ctx.req.valid("json" as never) as z.infer<
			typeof updateAgentSchema
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

		const serviceContext = getServiceContext(ctx);
		const agent = await updateAgent(serviceContext, agentId, body);

		return ctx.json({
			status: "success",
			data: agent,
		});
	},
);

app.delete(
	"/:agentId",
	requireAuth,
	describeRoute({
		tags: ["agents"],
		summary: "Delete an agent",
		description: "Delete an agent",
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
		await deleteAgent(serviceContext, agentId);

		return ctx.json({
			status: "success",
		});
	},
);

app.post(
	"/:agentId/completions",
	validateCaptcha,
	describeRoute({
		tags: ["agents"],
		summary: "Create a completion for an agent",
		description: "Create a completion for an agent",
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
	zValidator("json", createChatCompletionsJsonSchema),
	async (ctx: Context) => {
		const { agentId } = ctx.req.param();
		const user = ctx.get("user");
		const anonymousUser = ctx.get("anonymousUser");

		if (!user && !anonymousUser) {
			return ctx.json(
				{
					status: "error",
					error: "Unauthorized",
				},
				401,
			);
		}

		const body = ctx.req.valid("json" as never) as ChatCompletionParameters;

		const serviceContext = getServiceContext(ctx);

		const response = await createAgentCompletion({
			env: ctx.env,
			context: serviceContext,
			body,
			agentId,
			user,
			anonymousUser,
		});

		return response instanceof Response ? response : ctx.json(response);
	},
);

export default app;
