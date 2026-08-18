import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import { assistantRecipes, resolveRecipeId } from "~/services/apps/recipes/catalog";
import {
  buildAllowedConnectorOperations,
  buildAllowedConnectorProviders,
} from "~/services/apps/recipes/runtime";

interface ProjectCapabilityReference {
  capability_id: string;
  kind: string;
}

export interface ProjectRecipeConnectorScope {
  operationsByProvider: Partial<Record<RecipeConnectorProvider, string[]>>;
  providers: RecipeConnectorProvider[];
}

export function resolveAllowedProjectConnectorOperations(params: {
  projectScope: ProjectRecipeConnectorScope | undefined;
  provider: RecipeConnectorProvider;
  recipeOperations: readonly string[] | undefined;
}): string[] | undefined {
  if (!params.projectScope) {
    return params.recipeOperations ? [...params.recipeOperations] : undefined;
  }

  const projectOperations = params.projectScope.operationsByProvider[params.provider] ?? [];

  return projectOperations.filter(
    (operation) => !params.recipeOperations || params.recipeOperations.includes(operation),
  );
}

export function resolveProjectRecipeConnectorScope(
  capabilities: readonly ProjectCapabilityReference[],
): ProjectRecipeConnectorScope {
  const recipeIds = new Set(
    capabilities
      .filter((capability) => capability.kind === "recipe")
      .map((capability) => resolveRecipeId(capability.capability_id)),
  );
  const providers = new Set<RecipeConnectorProvider>();
  const operationsByProvider = new Map<RecipeConnectorProvider, Set<string>>();

  for (const recipe of assistantRecipes) {
    if (!recipeIds.has(recipe.id)) {
      continue;
    }

    for (const provider of buildAllowedConnectorProviders(recipe)) {
      providers.add(provider);
    }

    for (const [provider, operations] of Object.entries(buildAllowedConnectorOperations(recipe))) {
      const scopedOperations = operationsByProvider.get(provider) ?? new Set();

      for (const operation of operations) {
        scopedOperations.add(operation);
      }

      operationsByProvider.set(provider, scopedOperations);
    }
  }

  return {
    providers: [...providers],
    operationsByProvider: Object.fromEntries(
      [...operationsByProvider].map(([provider, operations]) => [provider, [...operations]]),
    ),
  };
}
