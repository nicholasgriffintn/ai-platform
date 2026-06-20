import { recipeConfigurationSchema, recipeInstallationTriggerSchema } from "@assistant/schemas";
import { updateRecipeInstallation } from "~/services/apps/recipes";
import {
	getRecipeNotificationCapabilities,
	hasSmsNotificationTrigger,
} from "~/services/apps/recipes/notificationCapabilities";
import { getActiveRecipeSetup } from "~/services/apps/recipes/toolContext";
import { AssistantError } from "~/utils/errors";
import { jsonSchemaToZod } from "../jsonSchema";
import type { ApiToolDefinition } from "../types";

export const configure_recipe: ApiToolDefinition = {
	name: "configure_recipe",
	description:
		"Save configuration and triggers for the active recipe setup chat after the user confirms the details or asks you to choose sensible defaults. Call get_recipe first if you need the exact configuration field keys.",
	type: "premium",
	costPerCall: 0,
	permissions: ["write"],
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			recipeId: {
				type: "string",
				description: "Optional active recipe id. Must match the recipe being set up.",
			},
			configuration: {
				type: "object",
				description: "Recipe configuration values to save.",
			},
			triggers: {
				type: "array",
				description:
					"Recipe triggers to save. Include a manual trigger unless the user explicitly disables manual runs.",
				items: {
					type: "object",
					properties: {
						type: {
							type: "string",
							enum: ["manual", "schedule", "natural_language"],
						},
						enabled: {
							type: "boolean",
						},
						cronExpression: {
							type: "string",
							description: "Five-field cron expression for schedule triggers.",
						},
						prompt: {
							type: "string",
							description: "Optional instruction to use when the schedule runs.",
						},
						notificationChannel: {
							type: "string",
							enum: ["sms"],
						},
						notificationTarget: {
							type: "string",
						},
					},
					required: ["type"],
				},
			},
		},
	}),
	execute: async (args, context) => {
		const request = context.request;
		if (!request.context || !request.user?.id) {
			throw new Error("Signed-in user context is required for recipe setup tools");
		}

		const activeRecipe = getActiveRecipeSetup(request.request?.options);
		if (!activeRecipe?.installationId) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "No active installed recipe is available to configure in this chat.",
				data: { recipeId: activeRecipe?.id },
			};
		}

		if (typeof args.recipeId === "string" && args.recipeId !== activeRecipe.id) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "The requested recipe does not match the active recipe setup chat.",
				data: {
					recipeId: args.recipeId,
					activeRecipeId: activeRecipe.id,
				},
			};
		}

		const configuration =
			args.configuration === undefined
				? undefined
				: recipeConfigurationSchema.safeParse(args.configuration);
		if (configuration && !configuration.success) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "Recipe configuration is not valid.",
				data: { issues: configuration.error.issues },
			};
		}

		const triggers =
			args.triggers === undefined
				? undefined
				: recipeInstallationTriggerSchema.array().safeParse(args.triggers);
		if (triggers && !triggers.success) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "Recipe triggers are not valid.",
				data: { issues: triggers.error.issues },
			};
		}

		if (triggers && hasSmsNotificationTrigger(triggers.data)) {
			const notificationCapabilities = await getRecipeNotificationCapabilities({
				context: request.context,
				userId: request.user.id,
				apiBaseUrl: request.env.API_BASE_URL,
			});
			if (!notificationCapabilities.sms.available) {
				return {
					status: "needs_correction",
					name: "configure_recipe",
					content:
						"SMS notifications are not configured for this user. Save the recipe without SMS notificationChannel/notificationTarget, or ask the user to connect SMS first.",
					data: {
						recipeId: activeRecipe.id,
						installationId: activeRecipe.installationId,
						notificationCapabilities,
						recoverable: true,
					},
				};
			}
		}

		if (!configuration && !triggers) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "Provide recipe configuration, triggers, or both to save.",
				data: { recipeId: activeRecipe.id },
			};
		}

		let installation;
		try {
			installation = await updateRecipeInstallation({
				context: request.context,
				userId: request.user.id,
				installationId: activeRecipe.installationId,
				update: {
					...(configuration ? { configuration: configuration.data } : {}),
					...(triggers ? { triggers: triggers.data } : {}),
				},
			});
		} catch (error) {
			if (error instanceof AssistantError) {
				return {
					status: "needs_correction",
					name: "configure_recipe",
					content: `${error.message}. Call get_recipe for the exact configuration field keys, then retry configure_recipe.`,
					data: {
						recipeId: activeRecipe.id,
						installationId: activeRecipe.installationId,
						recoverable: true,
					},
				};
			}

			throw error;
		}

		if (!installation) {
			return {
				status: "error",
				name: "configure_recipe",
				content: "Recipe installation not found.",
				data: {
					recipeId: activeRecipe.id,
					installationId: activeRecipe.installationId,
				},
			};
		}

		return {
			status: "success",
			name: "configure_recipe",
			content: "Recipe setup saved.",
			data: { installation },
		};
	},
};
