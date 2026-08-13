import { Hono } from "hono";
import z from "zod/v4";

import {
	dynamicAppErrorResponseSchema,
	dynamicAppExecutionResponseSchema,
	dynamicAppExecutionUnauthorizedResponseSchema,
	dynamicAppSchema,
	dynamicAppsResponseSchema,
	errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
	executeProjectDynamicApp,
	getDynamicAppById,
	getDynamicAppCatalog,
} from "~/services/dynamic-apps";
import {
	getProjectExperienceCatalog,
	PROJECT_TOOL_DEFINITIONS,
} from "~/services/dynamic-apps/config";
import type { IRequest } from "~/types/chat";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

const dynamicApps = new Hono();
const routeLogger = createRouteLogger("dynamic-apps");

const dynamicAppParamsSchema = z.object({ id: z.string().min(1) });
const dynamicAppExecutionBodySchema = z.record(z.string(), z.any());
const dynamicAppExecutionQuerySchema = z.object({ projectId: z.string().min(1) });

dynamicApps.use("*", (c, next) => {
	routeLogger.info(`Processing dynamic-apps route: ${c.req.path}`);
	return next();
});

addRoute(dynamicApps, "get", "/", {
	tags: ["dynamic-apps"],
	summary: "List all available dynamic apps",
	description: "Returns a list of all registered dynamic apps with their basic information",
	auth: "user-or-anonymous",
	responses: {
		200: {
			description: "Dynamic apps and featured listings",
			schema: dynamicAppsResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async () => ({
		apps: await getDynamicAppCatalog(),
		experiences: getProjectExperienceCatalog(),
		tools: PROJECT_TOOL_DEFINITIONS,
	}),
});

addRoute(dynamicApps, "get", "/:id", {
	tags: ["dynamic-apps"],
	summary: "Get dynamic app schema",
	description: "Returns the complete schema for a specific dynamic app",
	auth: "user-or-anonymous",
	paramSchema: dynamicAppParamsSchema,
	responses: {
		200: { description: "Dynamic app schema", schema: dynamicAppSchema },
		400: { description: "Bad request", schema: dynamicAppErrorResponseSchema },
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
		404: { description: "App not found", schema: dynamicAppErrorResponseSchema },
	},
	handler: async ({ params }) => {
		const app = await getDynamicAppById(params.id);
		if (!app) {
			throw new AssistantError("App not found", ErrorType.NOT_FOUND, 404);
		}

		return app;
	},
});

addRoute(dynamicApps, "post", "/:id/execute", {
	tags: ["dynamic-apps"],
	summary: "Execute dynamic app",
	description: "Executes a dynamic app with the provided form data",
	auth: true,
	paramSchema: dynamicAppParamsSchema,
	querySchema: dynamicAppExecutionQuerySchema,
	bodySchema: dynamicAppExecutionBodySchema,
	responses: {
		200: {
			description: "App execution result",
			schema: dynamicAppExecutionResponseSchema,
		},
		400: { description: "Invalid form data", schema: dynamicAppErrorResponseSchema },
		401: {
			description: "Authentication required",
			schema: dynamicAppExecutionUnauthorizedResponseSchema,
		},
		404: { description: "App not found", schema: dynamicAppErrorResponseSchema },
		500: { description: "Server error", schema: dynamicAppErrorResponseSchema },
	},
	handler: async ({ body, params, query, raw, serviceContext, user }) => {
		const requestUrl = new URL(raw.req.url);
		const req: IRequest = {
			app_url: `${requestUrl.protocol}//${requestUrl.host}`,
			env: serviceContext.env,
			request: {
				completion_id: generateId(),
				input: "dynamic-app-execution",
				date: new Date().toISOString(),
				platform: "dynamic-apps",
			},
			user,
			context: serviceContext,
		};

		return executeProjectDynamicApp(params.id, body, req, query.projectId);
	},
});

export default dynamicApps;
