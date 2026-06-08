import { Hono } from "hono";
import z from "zod/v4";

import {
	errorResponseSchema,
	recipeConnectorApiKeyRequestSchema,
	recipeConnectorProviderSchema,
	recipeConnectorsResponseSchema,
	recipeConnectorStartRequestSchema,
	recipeConnectorStartResponseSchema,
} from "@assistant/schemas";
import { addRoute } from "~/lib/http/routeBuilder";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	completeRecipeConnectorAuthorization,
	deleteRecipeConnectorConnection,
	listRecipeConnectors,
	startRecipeConnectorAuthorization,
	storeRecipeConnectorApiKey,
} from "~/services/apps/connectors";

const app = new Hono();

const providerParamSchema = z.object({ provider: recipeConnectorProviderSchema });

addRoute(app, "get", "/", {
	auth: true,
	tags: ["apps"],
	summary: "List recipe connectors",
	responses: {
		200: { description: "Recipe connectors", schema: recipeConnectorsResponseSchema },
	},
	handler: async ({ raw, serviceContext, user }) =>
		listRecipeConnectors({
			context: serviceContext,
			userId: user.id,
			requestUrl: raw.req.url,
		}),
});

addRoute(app, "post", "/:provider/start", {
	auth: true,
	tags: ["apps"],
	summary: "Start connector authorization",
	paramSchema: providerParamSchema,
	bodySchema: recipeConnectorStartRequestSchema,
	responses: {
		200: {
			description: "Connector authorization URL",
			schema: recipeConnectorStartResponseSchema,
		},
		400: { description: "Invalid connector", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, body, serviceContext, user }) =>
		startRecipeConnectorAuthorization({
			context: serviceContext,
			userId: user.id,
			provider: params.provider,
			returnTo: body.returnTo,
			requestUrl: raw.req.url,
		}),
});

addRoute(app, "get", "/:provider/callback", {
	tags: ["apps"],
	summary: "Complete connector authorization",
	paramSchema: providerParamSchema,
	querySchema: z.object({
		code: z.string().optional(),
		state: z.string().optional(),
		error: z.string().optional(),
	}),
	responses: {
		302: { description: "Redirects to the app after authorization" },
		400: { description: "Invalid callback", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, query, serviceContext }) => {
		if (query.error) {
			return ResponseFactory.error(raw, `Connector authorization failed: ${query.error}`, 400);
		}
		if (!query.code || !query.state) {
			return ResponseFactory.error(raw, "Connector callback is missing code or state", 400);
		}

		const redirectUrl = await completeRecipeConnectorAuthorization({
			context: serviceContext,
			provider: params.provider,
			code: query.code,
			state: query.state,
			requestUrl: raw.req.url,
		});

		return raw.redirect(redirectUrl);
	},
});

addRoute(app, "post", "/:provider/api-key", {
	auth: true,
	tags: ["apps"],
	summary: "Store connector API key",
	paramSchema: providerParamSchema,
	bodySchema: recipeConnectorApiKeyRequestSchema,
	responses: {
		200: { description: "Connector API key stored" },
		400: { description: "Invalid connector", schema: errorResponseSchema },
	},
	handler: async ({ params, body, serviceContext, user }) =>
		storeRecipeConnectorApiKey({
			context: serviceContext,
			userId: user.id,
			provider: params.provider,
			apiKey: body.apiKey,
		}),
});

addRoute(app, "delete", "/:provider", {
	auth: true,
	tags: ["apps"],
	summary: "Disconnect a recipe connector",
	paramSchema: providerParamSchema,
	responses: {
		200: { description: "Connector disconnected" },
		400: { description: "Invalid connector", schema: errorResponseSchema },
	},
	handler: async ({ params, serviceContext, user }) =>
		deleteRecipeConnectorConnection({
			context: serviceContext,
			userId: user.id,
			provider: params.provider,
		}),
});

export default app;
