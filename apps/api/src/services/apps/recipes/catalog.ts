import type { AssistantRecipe, RecipeCategory, RecipeKind } from "@ngriffin_uk/polychat-schemas";
import { recipeConnectorProviderSchema } from "@ngriffin_uk/polychat-schemas";
import { isConnectorOperationSupported } from "~/lib/providers/capabilities/connectors";
import { configuredComposioToolkits } from "~/lib/providers/capabilities/connectors/composio/configured-toolkit-manifest";
import { mailCalendarRecipes } from "./catalog/mail-calendar";
import { coreIntegrationRecipes } from "./catalog/core-integrations";
import { configuredComposioRecipes } from "./catalog/configured-composio";
import { composioWorkflowRecipes } from "./catalog/composio-workflows";
import { developerRecipes } from "./catalog/developer";
import { healthConnectorRecipes } from "./catalog/health-connectors";
import { workspaceRecipes } from "./catalog/workspace";
import { wellbeingRecipes } from "./catalog/wellbeing";
import { personalUtilityRecipes } from "./catalog/personal-utilities";
import type { CatalogRecipe } from "./catalog/shared";
export {
	IMAGE_TOOL,
	PASHI_DISCOVERY_TOOL,
	PASHI_EXECUTION_TOOL,
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
	...configuredComposioRecipes,
	...composioWorkflowRecipes,
	...developerRecipes,
	...healthConnectorRecipes,
	...workspaceRecipes,
	...wellbeingRecipes,
	...personalUtilityRecipes,
];

export const assistantRecipes: AssistantRecipe[] = catalogRecipes.map((recipe) => ({
	...recipe,
	triggers:
		recipe.integrations.some((integration) => integration.requiresConnection) &&
		!recipe.triggers.some((trigger) => trigger.type === "event")
			? [
					...recipe.triggers,
					{
						type: "event" as const,
						label: "Connected app event",
						description: "Run when a selected connected app emits a configured event.",
					},
				]
			: recipe.triggers,
	configurationFields: (recipe.configurationFields ?? []).map((field) => ({
		required: false,
		...field,
	})),
}));

export function resolveRecipeId(recipeId: string): string {
	if (assistantRecipes.some((recipe) => recipe.id === recipeId)) {
		return recipeId;
	}

	return recipeId;
}

export function getRecipeIdAliases(recipeId: string): string[] {
	return [recipeId];
}

export function getRecipeCatalogValidationIssues(
	recipes: readonly AssistantRecipe[] = assistantRecipes,
): string[] {
	const issues: string[] = [];
	const exposedProviders = new Set(
		recipes.flatMap((recipe) => recipe.integrations.map((integration) => integration.providerId)),
	);

	for (const providerId of Object.keys(configuredComposioToolkits).sort()) {
		if (!exposedProviders.has(providerId)) {
			issues.push(`configured Composio provider ${providerId} is not exposed by any recipe`);
		}
	}

	for (const recipe of recipes) {
		for (const integration of recipe.integrations) {
			const provider = recipeConnectorProviderSchema.safeParse(integration.providerId);
			if (!provider.success) {
				continue;
			}

			for (const operationId of integration.operationIds ?? []) {
				if (!isConnectorOperationSupported(provider.data, operationId)) {
					issues.push(
						`${recipe.id}:${integration.id} declares unsupported ${provider.data}.${operationId}`,
					);
				}
			}
		}
	}

	return issues;
}

const catalogIssues = getRecipeCatalogValidationIssues();
if (catalogIssues.length > 0) {
	throw new Error(`Invalid recipe catalog:\n${catalogIssues.join("\n")}`);
}

export const recipeFilters: RecipeKind[] = ["automate", "integrate"];

export const recipeCategories: RecipeCategory[] = Array.from(
	new Set(assistantRecipes.map((recipe) => recipe.category)),
).sort((a, b) => a.localeCompare(b)) as RecipeCategory[];
