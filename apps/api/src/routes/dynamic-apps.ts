import { Hono } from "hono";
import z from "zod/v4";

import {
	dynamicAppErrorResponseSchema,
	dynamicAppExecutionResponseSchema,
	dynamicAppExecutionUnauthorizedResponseSchema,
	dynamicAppSchema,
	dynamicAppStoredResponseResponseSchema,
	dynamicAppStoredResponsesResponseSchema,
	dynamicAppsResponseSchema,
	listDynamicAppResponsesQuerySchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
	executeDynamicApp,
	getDynamicAppById,
	getDynamicAppCatalog,
	getDynamicAppResponseById,
	listDynamicAppResponsesForUser,
} from "~/services/dynamic-apps";
import type { IRequest } from "~/types/chat";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

const dynamicApps = new Hono();
const routeLogger = createRouteLogger("dynamic-apps");

const dynamicAppParamsSchema = z.object({ id: z.string().min(1) });
const dynamicAppResponseParamsSchema = z.object({ responseId: z.string().min(1) });
const dynamicAppExecutionBodySchema = z.record(z.string(), z.any());

dynamicApps.use("*", (c, next) => {
	routeLogger.info(`Processing dynamic-apps route: ${c.req.path}`);
	return next();
});

addRoute(dynamicApps, "get", "/", {
	tags: ["dynamic-apps"],
	summary: "List all available dynamic apps",
	description: "Returns a list of all registered dynamic apps with their basic information",
	auth: true,
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
	}),
});

addRoute(dynamicApps, "get", "/responses", {
	tags: ["dynamic-apps"],
	summary: "List stored dynamic-app responses for user",
	auth: true,
	querySchema: listDynamicAppResponsesQuerySchema,
	responses: {
		200: { description: "Array of responses", schema: dynamicAppStoredResponsesResponseSchema },
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ query, serviceContext, user }) =>
		listDynamicAppResponsesForUser(serviceContext, user.id, query.appId),
});

addRoute(dynamicApps, "get", "/:id", {
	tags: ["dynamic-apps"],
	summary: "Get dynamic app schema",
	description: "Returns the complete schema for a specific dynamic app",
	auth: true,
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
	handler: async ({ body, params, raw, serviceContext, user }) => {
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

		return executeDynamicApp(params.id, body, req);
	},
});

addRoute(dynamicApps, "get", "/responses/:responseId", {
	tags: ["dynamic-apps"],
	summary: "Get stored dynamic-app response",
	description: "Retrieve a stored dynamic-app response by its `id` (response_id)",
	auth: true,
	paramSchema: dynamicAppResponseParamsSchema,
	responses: {
		200: {
			description: "Stored dynamic-app response",
			schema: dynamicAppStoredResponseResponseSchema,
		},
		400: { description: "Bad request", schema: dynamicAppErrorResponseSchema },
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
		404: { description: "Response not found", schema: dynamicAppErrorResponseSchema },
	},
	handler: async ({ params, serviceContext, user }) => {
		const data = await getDynamicAppResponseById(serviceContext, user.id, params.responseId);
		if (!data) {
			throw new AssistantError("Response not found", ErrorType.NOT_FOUND, 404);
		}

		return { response: data };
	},
});

export default dynamicApps;
