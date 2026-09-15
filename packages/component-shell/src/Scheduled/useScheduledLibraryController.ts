import type { CapabilityFilter } from "@ngriffin_uk/polychat-component-capabilities";
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
import { useMemo, useState } from "react";

import type { CapabilityLibraryScope } from "../Capabilities/useCapabilityLibraryController.js";
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
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<CapabilityFilter[]>([]);
  const [category, setCategory] = useState("all");

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
  const configuredOnly = selectedFilters.includes("configured");
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
    query,
    recipeById,
    selectedFilters,
    setCategory,
    setQuery,
    setSelectedFilters: (nextFilters: CapabilityFilter[]) => {
      setSelectedFilters(nextFilters);
      setCategory("all");
    },
    workflows: recipeWorkflows,
    addItem,
    removeCapability,
  };
}
