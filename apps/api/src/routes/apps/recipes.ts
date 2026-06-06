import { Hono } from "hono";
import z from "zod/v4";

import {
	assistantRecipeInstallRequestSchema,
	assistantRecipeInstallResponseSchema,
	assistantRecipesResponseSchema,
	errorResponseSchema,
} from "@assistant/schemas";
import { addRoute } from "~/lib/http/routeBuilder";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import {
	assistantRecipes,
	createRecipeMessageUrl,
	getRecipeById,
	recipeCategories,
	recipeFilters,
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
	handler: async () => ({
		recipes: assistantRecipes,
		categories: recipeCategories,
		filters: recipeFilters,
	}),
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
	handler: async ({ raw, params }) => {
		const recipe = getRecipeById(params.id);
		if (!recipe) {
			return ResponseFactory.error(raw, "Recipe not found", 404);
		}

		return recipe;
	},
});

addRoute(app, "post", "/:id/install", {
	tags: ["apps"],
	summary: "Start recipe setup",
	description:
		"Creates the setup payload a client can use to open a chat with the assistant and complete integration configuration conversationally.",
	paramSchema: z.object({ id: z.string() }),
	bodySchema: assistantRecipeInstallRequestSchema,
	responses: {
		200: { description: "Recipe setup payload", schema: assistantRecipeInstallResponseSchema },
		404: { description: "Recipe not found", schema: errorResponseSchema },
	},
	handler: async ({ raw, params, body }) => {
		const recipe = getRecipeById(params.id);
		if (!recipe) {
			return ResponseFactory.error(raw, "Recipe not found", 404);
		}

		const channelCopy =
			body.channel === "ios" ? "on iOS" : body.channel === "sms" ? "over text" : "in web chat";
		const conversationStarter = `${recipe.setupPrompt}\n\nI am starting this setup ${channelCopy}. Walk me through the required connections, confirm privacy boundaries, and ask before taking actions that send messages or change external systems.`;

		return {
			recipe,
			conversationStarter,
			messageUrl: createRecipeMessageUrl(conversationStarter),
			checklist: [
				"Confirm the goal and preferred notification channel",
				"Connect or verify required integrations",
				"Choose triggers, schedule, and approval rules",
				"Send a test run before enabling automation",
			],
		};
	},
});

export default app;
