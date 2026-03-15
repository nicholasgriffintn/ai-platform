import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import {
	githubConnectionSchema,
	errorResponseSchema,
	successResponseSchema,
	storeProviderApiKeySchema,
	updateUserSettingsResponseSchema,
	updateUserSettingsSchema,
	userModelsResponseSchema,
	providersResponseSchema,
	type GitHubConnectionPayload,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	updateUserSettings,
	getUserEnabledModels,
	storeProviderApiKey,
	getUserProviderSettings,
	syncUserProviders,
} from "~/services/user/userOperations";
import { upsertGitHubConnectionForUser } from "~/services/github/manage-connections";
import { AssistantError, ErrorType } from "~/utils/errors";
import apiKeys from "./apiKeys";
import exportHistoryRoute from "./export-history";

const app = new Hono();
const routeLogger = createRouteLogger("user");

app.use("/*", requireAuth);

app.use("/*", (c, next) => {
	routeLogger.info(`Processing user route: ${c.req.path}`);
	return next();
});

addRoute(app, "put", "/settings", {
	tags: ["user"],
	summary: "Update user settings",
	description: "Updates various user preferences and settings",
	bodySchema: updateUserSettingsSchema,
	responses: {
		200: {
			description: "User settings updated successfully",
			schema: updateUserSettingsResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const settings = c.req.valid(
				"json" as never,
			) as typeof updateUserSettingsSchema;
			const user = c.get("user");

			if (!user) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const serviceContext = getServiceContext(c);
			const result = await updateUserSettings(
				serviceContext,
				settings,
				user.id,
			);

			return ResponseFactory.success(c, result);
		})(raw),
});

addRoute(app, "get", "/models", {
	tags: ["user"],
	summary: "Get the models that the user has enabled",
	description: "Returns a list of model IDs that the user has enabled for use",
	responses: {
		200: {
			description: "List of enabled models",
			schema: userModelsResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");

			if (!user) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const serviceContext = getServiceContext(c);
			const models = await getUserEnabledModels(serviceContext, user.id);

			return ResponseFactory.success(c, models);
		})(raw),
});

addRoute(app, "post", "/github-app-connection", {
	tags: ["user"],
	summary: "Create or update GitHub App connection",
	description:
		"Stores encrypted GitHub App credentials for the authenticated user and installation",
	bodySchema: githubConnectionSchema,
	responses: {
		200: {
			description: "Connection saved successfully",
			schema: successResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");
			if (!user?.id) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const payload = c.req.valid("json" as never) as GitHubConnectionPayload;
			const serviceContext = getServiceContext(c);
			await upsertGitHubConnectionForUser(serviceContext, user.id, payload);

			return ResponseFactory.success(c, {
				success: true,
				message: "GitHub App connection saved successfully",
			});
		})(raw),
});

addRoute(app, "post", "/store-provider-api-key", {
	tags: ["user"],
	summary: "Store provider API key",
	description: "Stores a provider API key for the authenticated user",
	bodySchema: storeProviderApiKeySchema,
	responses: {
		200: {
			description: "Provider API key stored successfully",
			schema: successResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");
			const { providerId, apiKey, secretKey } = c.req.valid(
				"json" as never,
			) as {
				providerId: string;
				apiKey: string;
				secretKey?: string;
			};

			if (!user) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const serviceContext = getServiceContext(c);
			const result = await storeProviderApiKey(
				serviceContext,
				providerId,
				apiKey,
				secretKey,
				user.id,
			);

			return ResponseFactory.success(c, result);
		})(raw),
});

addRoute(app, "get", "/providers", {
	tags: ["user"],
	summary: "Get the providers that the user has enabled",
	description: "Returns a list of providers and their settings for the user",
	responses: {
		200: {
			description: "List of provider settings",
			schema: providersResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");

			if (!user) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const serviceContext = getServiceContext(c);
			const providers = await getUserProviderSettings(serviceContext, user.id);

			return ResponseFactory.success(c, providers);
		})(raw),
});

addRoute(app, "post", "/sync-providers", {
	tags: ["user"],
	summary: "Sync providers",
	description: "Synchronizes available providers for the user",
	responses: {
		200: {
			description: "Providers synced successfully",
			schema: successResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");

			if (!user) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const serviceContext = getServiceContext(c);
			const result = await syncUserProviders(serviceContext, user.id);

			return ResponseFactory.success(c, result);
		})(raw),
});

app.route("/api-keys", apiKeys);
app.route("/export-chat-history", exportHistoryRoute);

export default app;
