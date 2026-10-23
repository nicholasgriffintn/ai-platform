import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  filterProjectCapabilities,
  getProjectCapabilityCategories,
  groupProjectCapabilities,
  useAssistantRecipes,
  useRecipeInstallations,
  type EnabledCapability,
} from "@ngriffin_uk/polychat-library-react";
import {
  createRecipeAssistantActionItem,
  isRecipeConfigured,
  type AssistantActionItem,
} from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

import type { CapabilityLibraryScope } from "../Capabilities/useCapabilityLibraryController.js";
import { useCatalogueFilters } from "../Capabilities/useCatalogueFilters.js";
import { buildOwnInstallationByRecipeId } from "../Recipes/installations.js";
import { useRecipeActionRequest } from "../Recipes/useRecipeActionRequest.js";
import { useRecipeWorkflows } from "../Recipes/useRecipeWorkflows.js";

const RECIPE_KINDS = ["recipe"] as const;

export function useScheduledLibraryController(scope: CapabilityLibraryScope) {
  const currentUserId = useChatStore((state) => state.user?.id);
  const recipesQuery = useAssistantRecipes();
  const installationsQuery = useRecipeInstallations(scope.surface.projectId);
  const recipeWorkflows = useRecipeWorkflows({
    conversationPath: scope.conversationPath,
    projectId: scope.surface.projectId,
  });
  const filters = useCatalogueFilters(RECIPE_KINDS);

  const recipes = useMemo(() => recipesQuery.data?.recipes ?? [], [recipesQuery.data?.recipes]);
  const recipeById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  );
  const items = useMemo(
    () => recipes.map((recipe) => createRecipeAssistantActionItem(recipe)),
    [recipes],
  );
  const installationByRecipeId = useMemo(
    () =>
      buildOwnInstallationByRecipeId(installationsQuery.data?.installations ?? [], currentUserId),
    [currentUserId, installationsQuery.data?.installations],
  );
  const configuredItemIds = useMemo(() => {
    const configured = new Set<string>();

    for (const item of items) {
      const recipe = recipeById.get(item.capability.id);
      const installation = installationByRecipeId.get(item.capability.id);

      if (recipe && isRecipeConfigured(recipe, installation)) {
        configured.add(item.id);
      }
    }

    return configured;
  }, [installationByRecipeId, items, recipeById]);
  const { category, installed: configuredOnly, query } = filters;
  const itemsForCategories = useMemo(
    () =>
      filterProjectCapabilities(items, {
        category: "all",
        configuredItemIds,
        configuredOnly,
        kinds: [...RECIPE_KINDS],
        query: "",
      }),
    [configuredItemIds, configuredOnly, items],
  );
  const categories = useMemo(
    () => getProjectCapabilityCategories(itemsForCategories, [...RECIPE_KINDS]),
    [itemsForCategories],
  );
  const visibleItems = useMemo(
    () =>
      filterProjectCapabilities(items, {
        category,
        configuredItemIds,
        configuredOnly,
        kinds: [...RECIPE_KINDS],
        query,
      }),
    [category, configuredItemIds, configuredOnly, items, query],
  );
  const groups = useMemo(() => groupProjectCapabilities(visibleItems), [visibleItems]);

  useRecipeActionRequest(recipes, installationByRecipeId, recipeWorkflows.actions);

  const addItem = (item: AssistantActionItem) => {
    if (!scope.requiresExplicitEnablement) {
      return;
    }

    void scope
      .add({ kind: "recipe", capabilityId: item.capability.id, configuration: {} })
      .catch(() => undefined);
  };

  const removeCapability = (capability: EnabledCapability & { id: string }) => {
    if (!scope.requiresExplicitEnablement) {
      return;
    }

    scope.remove(capability);
  };

  return {
    categories,
    category,
    currentUserId,
    error: recipesQuery.error ?? installationsQuery.error ?? scope.error,
    groups,
    installationByRecipeId,
    isLoading: recipesQuery.isLoading,
    installed: configuredOnly,
    kind: filters.kind,
    kinds: RECIPE_KINDS,
    query,
    recipeById,
    setCategory: filters.setCategory,
    setInstalled: filters.setInstalled,
    setKind: filters.setKind,
    setQuery: filters.setQuery,
    workflows: recipeWorkflows,
    addItem,
    removeCapability,
  };
}
