import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import z from "zod/v4";
import {
	appDataSchema,
	dynamicAppsResponseSchema,
	listDynamicAppResponsesQuerySchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	executeDynamicApp,
	getDynamicAppById,
	getDynamicApps,
	listDynamicAppResponsesForUser,
	getDynamicAppResponseById,
} from "~/services/dynamic-apps";
import { getFeaturedApps } from "~/services/dynamic-apps/config";
import { appSchema } from "~/types/app-schema";
import type { IRequest } from "~/types/chat";
import type { IEnv } from "~/types/shared";
import { getLogger } from "~/utils/logger";
import type { IUser } from "../types";
import { generateId } from "~/utils/id";
import { getServiceContext } from "~/lib/context/serviceContext";

const logger = getLogger({ prefix: "routes/dynamic-apps" });

const dynamicApps = new Hono();

const routeLogger = createRouteLogger("dynamic-apps");

dynamicApps.use("*", requireAuth);

dynamicApps.use("*", (c, next) => {
	routeLogger.info(`Processing dynamic-apps route: ${c.req.path}`);
	return next();
});

addRoute(dynamicApps, "get", "/", {
	tags: ["dynamic-apps"],
	summary: "List all available dynamic apps",
	description:
		"Returns a list of all registered dynamic apps with their basic information",
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
	handler: async ({ raw }) =>
		(async (c) => {
			const apps = await getDynamicApps();
			const featuredApps = getFeaturedApps();

			const mergedApps = new Map<string, any>();

			for (const app of apps) {
				mergedApps.set(app.id, {
					...app,
					featured: app.featured ?? false,
					kind: app.kind ?? "dynamic",
				});
			}

			for (const featuredApp of featuredApps) {
				const existing = mergedApps.get(featuredApp.id);
				mergedApps.set(featuredApp.id, {
					...existing,
					...featuredApp,
					featured: true,
					kind:
						featuredApp.kind ??
						existing?.kind ??
						(featuredApp.href ? "frontend" : "dynamic"),
				});
			}

			return ResponseFactory.success(c, {
				apps: Array.from(mergedApps.values()),
			});
		})(raw),
});

addRoute(dynamicApps, "get", "/responses", {
	tags: ["dynamic-apps"],
	summary: "List stored dynamic-app responses for user",
	querySchema: listDynamicAppResponsesQuerySchema,
	responses: {
		200: { description: "Array of responses", schema: z.array(appDataSchema) },
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user") as IUser;
			const { appId } = c.req.valid("query" as never) as {
				appId?: string;
			};

			const list = await listDynamicAppResponsesForUser(
				c.env as IEnv,
				user.id,
				appId,
			);
			return ResponseFactory.success(c, list);
		})(raw),
});

addRoute(dynamicApps, "get", "/:id", {
	tags: ["dynamic-apps"],
	summary: "Get dynamic app schema",
	description: "Returns the complete schema for a specific dynamic app",
	responses: {
		200: { description: "Dynamic app schema", schema: appSchema },
		400: { description: "Bad request", schema: errorResponseSchema },
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
		404: { description: "App not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const _user = c.get("user") as IUser | undefined;

			const id = c.req.param("id");
			if (!id) {
				return ResponseFactory.success(c, { error: "App ID is required" }, 400);
			}

			const app = await getDynamicAppById(id);

			if (!app) {
				return ResponseFactory.success(c, { error: "App not found" }, 404);
			}

			return ResponseFactory.success(c, app);
		})(raw),
});

addRoute(dynamicApps, "post", "/:id/execute", {
	tags: ["dynamic-apps"],
	summary: "Execute dynamic app",
	description: "Executes a dynamic app with the provided form data",
	responses: {
		200: { description: "App execution result", schema: z.string() },
		400: { description: "Invalid form data", schema: errorResponseSchema },
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
		404: { description: "App not found", schema: errorResponseSchema },
		500: { description: "Server error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const id = c.req.param("id");
			if (!id) {
				return ResponseFactory.success(c, { error: "App ID is required" }, 400);
			}

			const user = c.get("user");

			if (!user?.id) {
				return ResponseFactory.success(
					c,
					{
						response: {
							status: "error",
							message: "User not authenticated",
						},
					},
					401,
				);
			}

			const formData = await c.req.json();

			try {
				const app = await getDynamicAppById(id);

				if (!app) {
					return ResponseFactory.success(c, { error: "App not found" }, 404);
				}

				const url = new URL(c.req.url);
				const host = url.host;

				const req: IRequest = {
					app_url: `https://${host}`,
					env: c.env,
					request: {
						completion_id: generateId(),
						input: "dynamic-app-execution",
						date: new Date().toISOString(),
						platform: "dynamic-apps",
					},
					user,
					context: getServiceContext(c),
				};

				const result = await executeDynamicApp(id, formData, req);
				return ResponseFactory.success(c, result);
			} catch (error) {
				logger.error(`Error executing app ${id}:`, { error });
				return ResponseFactory.success(
					c,
					{
						error: "Failed to execute app",
						message: error instanceof Error ? error.message : "Unknown error",
					},
					500,
				);
			}
		})(raw),
});

addRoute(dynamicApps, "get", "/responses/:responseId", {
	tags: ["dynamic-apps"],
	summary: "Get stored dynamic-app response",
	description:
		"Retrieve a stored dynamic-app response by its `id` (response_id)",
	responses: {
		200: {
			description: "Stored dynamic-app response",
			schema: z.object({ response: z.any() }),
		},
		400: { description: "Bad request", schema: errorResponseSchema },
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
		404: { description: "Response not found", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const responseId = c.req.param("responseId");
			if (!responseId) {
				return ResponseFactory.success(
					c,
					{ error: "responseId is required" },
					400,
				);
			}
			const data = await getDynamicAppResponseById(c.env as IEnv, responseId);
			if (!data) {
				return ResponseFactory.success(c, { error: "Response not found" }, 404);
			}
			return ResponseFactory.success(c, { response: data });
		})(raw),
});

export default dynamicApps;
