import { Hono } from "hono";
import z from "zod/v4";

import {
	assistantRecipeInstallResponseSchema,
	assistantRecipesResponseSchema,
	errorResponseSchema,
	recipeInstallationSchema,
	recipeInstallationUpdateRequestSchema,
	recipeInstallationsResponseSchema,
	recipeInstallRequestSchema,
	recipeInvocationRequestSchema,
	recipeInvocationResponseSchema,
} from "@assistant/schemas";
import { addRoute } from "~/lib/http/routeBuilder";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	deleteRecipeInstallation,
	getAssistantRecipe,
	installAssistantRecipe,
	invokeAssistantRecipe,
	listAssistantRecipes,
	listRecipeInstallations,
	updateRecipeInstallation,
} from "~/services/apps/recipes";

const app = new Hono();

addRoute(app, "get", "/", {
	tags: ["apps"],
	summary: "List assistant recipes",
	description:
		"Returns one-tap assistant setups for integrations and automations that can be started from web, iOS, or messaging surfaces.",
	responses: {
		200: { description: "Assistant recipes", schema: assistantRecipesResponseSchema },
	},
	handler: async ({ raw, serviceContext, user }) =>
		listAssistantRecipes({
			context: serviceContext,
			userId: user?.id,
			requestUrl: raw.req.url,
		}),
});

addRoute(app, "get", "/installations", {
	auth: true,
	tags: ["apps"],
	summary: "List installed assistant recipes",
	responses: {
		200: {
			description: "Installed assistant recipes",
			schema: recipeInstallationsResponseSchema,
		},
	},
	handler: async ({ serviceContext, user }) =>
		listRecipeInstallations({ context: serviceContext, userId: user.id }),
});

addRoute(app, "put", "/installations/:installationId", {
	auth: true,
	tags: ["apps"],
	summary: "Update an installed assistant recipe",
	paramSchema: z.object({ installationId: z.string() }),
	bodySchema: recipeInstallationUpdateRequestSchema,
	responses: {
		200: {
			description: "Updated installed assistant recipe",
			schema: recipeInstallationSchema,
		},
		404: { description: "Recipe installation not found", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, body, serviceContext, user }) => {
		const installation = await updateRecipeInstallation({
			context: serviceContext,
			userId: user.id,
			installationId: params.installationId,
			update: body,
			requestUrl: raw.req.url,
		});

		if (!installation) {
			return ResponseFactory.error(raw, "Recipe installation not found", 404);
		}

		return installation;
	},
});

addRoute(app, "delete", "/installations/:installationId", {
	auth: true,
	tags: ["apps"],
	summary: "Delete an installed assistant recipe",
	paramSchema: z.object({ installationId: z.string() }),
	responses: {
		204: { description: "Recipe installation deleted" },
		404: { description: "Recipe installation not found", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, serviceContext, user }) => {
		const deleted = await deleteRecipeInstallation({
			context: serviceContext,
			userId: user.id,
			installationId: params.installationId,
		});

		if (!deleted) {
			return ResponseFactory.error(raw, "Recipe installation not found", 404);
		}

		return ResponseFactory.noContent(raw);
	},
});

addRoute(app, "get", "/:id", {
	tags: ["apps"],
	summary: "Get an assistant recipe",
	paramSchema: z.object({ id: z.string() }),
	responses: {
		200: {
			description: "Assistant recipe",
			schema: assistantRecipesResponseSchema.shape.recipes.element,
		},
		404: { description: "Recipe not found", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, serviceContext, user }) => {
		const recipe = await getAssistantRecipe(params.id, {
			context: serviceContext,
			userId: user?.id,
			requestUrl: raw.req.url,
		});
		if (!recipe) {
			return ResponseFactory.error(raw, "Recipe not found", 404);
		}

		return recipe;
	},
});

addRoute(app, "post", "/:id/install", {
	auth: true,
	tags: ["apps"],
	summary: "Start recipe setup",
	description:
		"Creates the setup payload a client can use to open a chat with the assistant and complete integration configuration conversationally.",
	paramSchema: z.object({ id: z.string() }),
	bodySchema: recipeInstallRequestSchema,
	responses: {
		200: { description: "Recipe setup payload", schema: assistantRecipeInstallResponseSchema },
		404: { description: "Recipe not found", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, body, serviceContext, user }) => {
		const setup = await installAssistantRecipe(params.id, {
			context: serviceContext,
			userId: user.id,
			channel: body.channel,
			triggers: body.triggers,
			configuration: body.configuration,
			requestUrl: raw.req.url,
		});

		if (!setup) {
			return ResponseFactory.error(raw, "Recipe not found", 404);
		}

		return setup;
	},
});

addRoute(app, "post", "/:id/invoke", {
	auth: true,
	tags: ["apps"],
	summary: "Invoke an installed recipe",
	paramSchema: z.object({ id: z.string() }),
	bodySchema: recipeInvocationRequestSchema,
	responses: {
		200: { description: "Recipe invocation", schema: recipeInvocationResponseSchema },
		404: { description: "Recipe not found", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, body, serviceContext, user }) => {
		const invocation = await invokeAssistantRecipe(params.id, {
			context: serviceContext,
			userId: user.id,
			channel: body.channel,
			input: body.input,
			requestUrl: raw.req.url,
			requireInstalled: true,
		});

		if (!invocation) {
			return ResponseFactory.error(raw, "Recipe not found", 404);
		}

		return invocation;
	},
});

addRoute(app, "post", "/:id/queue", {
	auth: true,
	tags: ["apps"],
	summary: "Queue a recipe execution task",
	paramSchema: z.object({ id: z.string() }),
	bodySchema: recipeInvocationRequestSchema,
	responses: {
		200: { description: "Queued recipe invocation", schema: recipeInvocationResponseSchema },
		404: { description: "Recipe not found", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, body, serviceContext, user }) => {
		const invocation = await invokeAssistantRecipe(params.id, {
			context: serviceContext,
			userId: user.id,
			channel: body.channel,
			input: body.input,
			requestUrl: raw.req.url,
			queue: true,
			requireInstalled: true,
		});

		if (!invocation) {
			return ResponseFactory.error(raw, "Recipe not found", 404);
		}

		return invocation;
	},
});

export default app;
