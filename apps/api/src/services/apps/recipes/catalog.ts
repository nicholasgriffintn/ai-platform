import type { AssistantRecipe, RecipeCategory, RecipeKind } from "@assistant/schemas";
import { recipeConnectorProviderSchema } from "@assistant/schemas";
import {
	isConnectorOperationSupported,
	isConnectorOperationWrite,
} from "~/lib/providers/capabilities/connectors";
import { mailCalendarRecipes } from "./catalog/mail-calendar";
import { coreIntegrationRecipes } from "./catalog/core-integrations";
import { developerRecipes } from "./catalog/developer";
import { healthConnectorRecipes } from "./catalog/health-connectors";
import { workspaceRecipes } from "./catalog/workspace";
import { wellbeingRecipes } from "./catalog/wellbeing";
import { personalUtilityRecipes } from "./catalog/personal-utilities";
import type { CatalogRecipe } from "./catalog/shared";
export {
	IMAGE_TOOL,
	QR_TOOL,
	RECIPE_CONNECTOR_TOOL,
	RECIPE_LOOKUP_TOOL,
	RECIPE_SETUP_TOOL,
	RECIPE_TRIGGER_TOOL,
	WEATHER_TOOL,
	WEB_SEARCH_TOOL,
} from "./catalog/shared";

const catalogRecipes: CatalogRecipe[] = [
	...mailCalendarRecipes,
	...coreIntegrationRecipes,
	...developerRecipes,
	...healthConnectorRecipes,
	...workspaceRecipes,
	...wellbeingRecipes,
	...personalUtilityRecipes,
];

export const assistantRecipes: AssistantRecipe[] = catalogRecipes.map((recipe) => ({
	...recipe,
	configurationFields: (recipe.configurationFields ?? []).map((field) => ({
		required: false,
		...field,
	})),
}));

export function getRecipeCatalogValidationIssues(
	recipes: readonly AssistantRecipe[] = assistantRecipes,
): string[] {
	const issues: string[] = [];

	for (const recipe of recipes) {
		const hasScheduleTrigger = recipe.triggers.some((trigger) => trigger.type === "schedule");

		for (const integration of recipe.integrations) {
			const provider = recipeConnectorProviderSchema.safeParse(integration.providerId);
			if (!provider.success || provider.data === "github") {
				continue;
			}

			for (const operationId of integration.operationIds ?? []) {
				if (!isConnectorOperationSupported(provider.data, operationId)) {
					issues.push(
						`${recipe.id}:${integration.id} declares unsupported ${provider.data}.${operationId}`,
					);
					continue;
				}

				if (hasScheduleTrigger && isConnectorOperationWrite(provider.data, operationId)) {
					issues.push(
						`${recipe.id}:${integration.id} declares scheduled write operation ${provider.data}.${operationId}`,
					);
				}
			}
		}
	}

	return issues;
}

export const recipeFilters: RecipeKind[] = ["automate", "integrate"];

export const recipeCategories: RecipeCategory[] = Array.from(
	new Set(assistantRecipes.map((recipe) => recipe.category)),
).sort((a, b) => a.localeCompare(b)) as RecipeCategory[];
