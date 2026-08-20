import type {
  RecipeConfiguration,
  RecipeInstallation,
  RecipeInstallationsResponse,
  RecipeInstallationTrigger,
  RecipeInstallationUpdateRequest,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteRecipeInstallation,
  installAssistantRecipe,
  invokeAssistantRecipe,
  listAssistantRecipes,
  listRecipeInstallations,
  updateRecipeInstallation,
} from "~/lib/api/recipes";

import { useCanAccessProFeatures } from "./useCanAccessProFeatures";

export const ASSISTANT_RECIPES_QUERY_KEY = ["assistant-recipes"] as const;
export const RECIPE_INSTALLATIONS_QUERY_KEY = ["recipe-installations"] as const;

const RECIPE_CATALOG_STALE_TIME = 30 * 60 * 1000;
const RECIPE_CATALOG_GC_TIME = 60 * 60 * 1000;

function recipeInstallationsQueryKey(projectId?: string | null) {
  return projectId
    ? [...RECIPE_INSTALLATIONS_QUERY_KEY, projectId]
    : RECIPE_INSTALLATIONS_QUERY_KEY;
}

function upsertRecipeInstallation(
  queryClient: ReturnType<typeof useQueryClient>,
  installation: RecipeInstallation,
) {
  queryClient.setQueryData<RecipeInstallationsResponse>(
    recipeInstallationsQueryKey(installation.projectId),
    (current) => ({
      installations: [
        installation,
        ...(current?.installations ?? []).filter((item) => item.id !== installation.id),
      ],
    }),
  );
}

export function useAssistantRecipes({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ASSISTANT_RECIPES_QUERY_KEY,
    queryFn: listAssistantRecipes,
    enabled,
    staleTime: RECIPE_CATALOG_STALE_TIME,
    gcTime: RECIPE_CATALOG_GC_TIME,
  });
}

export function useInstallAssistantRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      projectId,
      triggers,
      configuration,
    }: {
      recipeId: string;
      projectId?: string;
      triggers?: RecipeInstallationTrigger[];
      configuration?: RecipeConfiguration;
    }) => installAssistantRecipe(recipeId, triggers, configuration, projectId),
    onSuccess: (response) => {
      if (response.installation) {
        upsertRecipeInstallation(queryClient, response.installation);
      }

      void queryClient.invalidateQueries({ queryKey: RECIPE_INSTALLATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY });
    },
  });
}

export function useInvokeAssistantRecipe() {
  return useMutation({
    mutationFn: ({
      recipeId,
      input,
      projectId,
    }: {
      recipeId: string;
      input?: string;
      projectId?: string;
    }) => invokeAssistantRecipe(recipeId, input, projectId),
  });
}

export function useRecipeInstallations(
  projectId?: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const canAccessProFeatures = useCanAccessProFeatures();
  const isEnabled = canAccessProFeatures && enabled;
  const query = useQuery({
    queryKey: recipeInstallationsQueryKey(projectId),
    queryFn: () => listRecipeInstallations(projectId),
    enabled: isEnabled,
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    data: isEnabled ? query.data : undefined,
    error: isEnabled ? query.error : null,
    isFetching: isEnabled ? query.isFetching : false,
    isLoading: isEnabled ? query.isLoading : false,
  };
}

export function useUpdateRecipeInstallation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      installationId,
      update,
    }: {
      installationId: string;
      update: RecipeInstallationUpdateRequest;
    }) => updateRecipeInstallation(installationId, update),
    onSuccess: (installation) => {
      upsertRecipeInstallation(queryClient, installation);
      void queryClient.invalidateQueries({ queryKey: RECIPE_INSTALLATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY });
    },
  });
}

export function useDeleteRecipeInstallation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installationId }: { installationId: string }) =>
      deleteRecipeInstallation(installationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RECIPE_INSTALLATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY });
    },
  });
}
