import {
  configuredComposioToolkits,
  isConnectorOperationSupported,
} from "@ngriffin_uk/polychat-ai-integrations";
import type { AssistantRecipe, RecipeCategory, RecipeKind } from "@ngriffin_uk/polychat-schemas";
import { recipeConnectorProviderSchema } from "@ngriffin_uk/polychat-schemas";

import { composioWorkflowRecipes } from "./catalog/composio-workflows";
import { configuredComposioRecipes } from "./catalog/configured-composio";
import { coreIntegrationRecipes } from "./catalog/core-integrations";
import { developerRecipes } from "./catalog/developer";
import { healthConnectorRecipes } from "./catalog/health-connectors";
import { mailCalendarRecipes } from "./catalog/mail-calendar";
import { personalUtilityRecipes } from "./catalog/personal-utilities";
import { getPlatformKnowledgeRecipes } from "./catalog/platform-knowledge";
import type { CatalogRecipe } from "./catalog/shared";
import { wellbeingRecipes } from "./catalog/wellbeing";
import { workspaceRecipes } from "./catalog/workspace";
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

let assistantRecipes: AssistantRecipe[] | undefined;

export function getAssistantRecipes(): AssistantRecipe[] {
  if (assistantRecipes) {
    return assistantRecipes;
  }

  const catalogRecipes: CatalogRecipe[] = [
    ...getPlatformKnowledgeRecipes(),
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

  const recipes: AssistantRecipe[] = catalogRecipes.map((recipe) => ({
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

  const issues = getRecipeCatalogValidationIssues(recipes);

  if (issues.length > 0) {
    throw new Error(`Invalid recipe catalog:\n${issues.join("\n")}`);
  }

  assistantRecipes = recipes;

  return assistantRecipes;
}

export function resolveRecipeId(recipeId: string): string {
  return recipeId;
}

export function getRecipeById(id: string): AssistantRecipe | undefined {
  return getAssistantRecipes().find((recipe) => recipe.id === resolveRecipeId(id));
}

export function getRecipeIdAliases(recipeId: string): string[] {
  return [recipeId];
}

export function getRecipeCatalogValidationIssues(
  recipes: readonly AssistantRecipe[] = getAssistantRecipes(),
): string[] {
  const issues: string[] = [];
  const exposedProviders = new Set<string>();

  for (const recipe of recipes) {
    for (const integration of recipe.integrations) {
      exposedProviders.add(integration.providerId);
    }
  }

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

export const recipeFilters: RecipeKind[] = ["automate", "integrate"];

export function getRecipeCategories(): RecipeCategory[] {
  return Array.from(new Set(getAssistantRecipes().map((recipe) => recipe.category))).sort((a, b) =>
    a.localeCompare(b),
  );
}
