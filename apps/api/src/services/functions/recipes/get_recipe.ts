import { getAssistantRecipe } from "~/services/apps/recipes";
import { getRecipeNotificationCapabilities } from "~/services/apps/recipes/notificationCapabilities";
import {
	getActiveRecipeSetup,
	getRecipeConfiguration,
	getRecipeExecutionChannel,
} from "~/services/apps/recipes/toolContext";
import { jsonSchemaToZod } from "../jsonSchema";
import type { ApiToolDefinition } from "../types";

export const get_recipe: ApiToolDefinition = {
	name: "get_recipe",
	description:
		"Get the active recipe setup contract, including exact configuration field keys, saved configuration, trigger types, and enabled tools. Use this before configure_recipe when setting up or correcting a recipe.",
	type: "premium",
	costPerCall: 0,
	permissions: ["read"],
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			recipeId: {
				type: "string",
				description:
					"Optional recipe id. Defaults to the active recipe setup chat and must match it when provided.",
			},
		},
	}),
	execute: async (args, context) => {
		const request = context.request;
		if (!request.context || !request.user?.id) {
			throw new Error("Signed-in user context is required for recipe setup tools");
		}

		const activeRecipe = getActiveRecipeSetup(request.request?.options);
		const requestedRecipeId = typeof args.recipeId === "string" ? args.recipeId : undefined;
		const recipeId = requestedRecipeId ?? activeRecipe?.id;
		if (!recipeId) {
			return {
				status: "error",
				name: "get_recipe",
				content: "No active recipe is available in this chat.",
				data: {},
			};
		}

		if (activeRecipe?.id && requestedRecipeId && requestedRecipeId !== activeRecipe.id) {
			return {
				status: "error",
				name: "get_recipe",
				content: "The requested recipe does not match the active recipe setup chat.",
				data: {
					recipeId: requestedRecipeId,
					activeRecipeId: activeRecipe.id,
				},
			};
		}

		const recipe = await getAssistantRecipe(recipeId, {
			context: request.context,
			userId: request.user.id,
			requestUrl: request.app_url,
		});
		if (!recipe) {
			return {
				status: "error",
				name: "get_recipe",
				content: "Recipe not found.",
				data: { recipeId },
			};
		}

		const notificationCapabilities = await getRecipeNotificationCapabilities({
			context: request.context,
			userId: request.user.id,
			apiBaseUrl: request.env.API_BASE_URL,
		});

		return {
			status: "success",
			name: "get_recipe",
			content: `Recipe configuration fields loaded. ${notificationCapabilities.sms.guidance}`,
			data: {
				recipeId: recipe.id,
				title: recipe.title,
				channel: getRecipeExecutionChannel(request.request?.options),
				configurationFields: recipe.configurationFields,
				triggers: recipe.triggers,
				enabledTools: recipe.enabledTools,
				notificationCapabilities,
				savedConfiguration: getRecipeConfiguration(request.request?.options),
			},
		};
	},
};
