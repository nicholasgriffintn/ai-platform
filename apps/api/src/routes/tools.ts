import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";
import z from "zod/v4";

import {
	errorResponseSchema,
	savedToolConfigurationSchema,
	savedToolConfigurationsResponseSchema,
	modelToolIdSchema,
	runnableToolExecuteRequestSchema,
	runnableToolResponseSchema,
	runnableToolSchema,
	toolsResponseSchema,
	saveToolConfigurationSchema,
} from "@ngriffin_uk/polychat-schemas";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { runFunctionWithOutput } from "~/services/functions/run-with-output";
import { getRunnableTool } from "~/services/tools/runnable";
import { getAvailableTools } from "~/services/tools/toolsOperations";
import {
	listModelToolConfigurations,
	saveModelToolConfiguration,
} from "~/services/tools/modelToolConfigurations";
import { projectScopeQuerySchema } from "~/services/workspaces/access";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

const app = new Hono();

const routeLogger = createRouteLogger("tools");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing tools route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/", {
	tags: ["tools"],
	summary: "List Tools",
	description: "Lists the currently available tools.",
	responses: {
		200: {
			description: "List of available tools with their details",
			schema: toolsResponseSchema,
		},
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ user }) => {
		const isPro = user?.plan_id === "pro";
		return getAvailableTools(isPro, Boolean(user?.id));
	},
});

const toolParamsSchema = z.object({ id: z.string().min(1) });
const configurableToolParamsSchema = z.object({ id: modelToolIdSchema });

addRoute(app, "get", "/configurations", {
	auth: true,
	tags: ["tools"],
	summary: "List tool configurations",
	description: "Returns saved model-tool configuration for the authenticated scope.",
	responses: {
		200: {
			description: "Saved tool configurations",
			schema: savedToolConfigurationsResponseSchema,
		},
	},
	handler: async ({ serviceContext, user }) =>
		listModelToolConfigurations(serviceContext, { type: "user", id: user.id }),
});

addRoute(app, "put", "/:id/configuration", {
	auth: true,
	tags: ["tools"],
	summary: "Save tool configuration",
	description: "Validates and saves model-tool configuration for the authenticated scope.",
	paramSchema: configurableToolParamsSchema,
	bodySchema: saveToolConfigurationSchema,
	responses: {
		200: {
			description: "Saved tool configuration",
			schema: savedToolConfigurationSchema,
		},
		400: { description: "Invalid tool configuration", schema: errorResponseSchema },
	},
	handler: async ({ body, params, serviceContext, user }) =>
		saveModelToolConfiguration(
			serviceContext,
			{ type: "user", id: user.id },
			params.id,
			body.configuration,
		),
});

addRoute(app, "get", "/:id", {
	tags: ["tools"],
	summary: "Get a runnable tool",
	description:
		"Returns a tool with a form derived from its input schema, so it can be run from the interface instead of by a model.",
	paramSchema: toolParamsSchema,
	responses: {
		200: { description: "Runnable tool", schema: runnableToolSchema },
		404: { description: "Tool not found", schema: errorResponseSchema },
	},
	handler: async ({ params }) => {
		const tool = getRunnableTool(params.id);
		if (!tool) {
			throw new AssistantError("Tool not found", ErrorType.NOT_FOUND, 404);
		}

		return tool;
	},
});

addRoute(app, "post", "/:id/execute", {
	auth: true,
	tags: ["tools"],
	summary: "Run a tool",
	description: "Runs a tool with the submitted form values and stores the result as an output.",
	paramSchema: toolParamsSchema,
	querySchema: projectScopeQuerySchema,
	bodySchema: runnableToolExecuteRequestSchema,
	responses: {
		200: { description: "Tool result", schema: runnableToolResponseSchema },
		404: { description: "Tool not found", schema: errorResponseSchema },
	},
	handler: async ({ body, params, query, raw, serviceContext, user }) => {
		if (!getRunnableTool(params.id)) {
			throw new AssistantError("Tool not found", ErrorType.NOT_FOUND, 404);
		}

		const requestUrl = new URL(raw.req.url);
		const req: IRequest = {
			app_url: `${requestUrl.protocol}//${requestUrl.host}`,
			env: serviceContext.env,
			request: {
				completion_id: generateId(),
				input: "tool-execution",
				date: new Date().toISOString(),
				platform: "tool-run",
			},
			user,
			context: serviceContext,
		};

		return runFunctionWithOutput(params.id, body, req, query.projectId);
	},
});

export default app;
