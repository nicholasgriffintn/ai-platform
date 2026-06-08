import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
	RecipeConfiguration,
	RecipeInstallationTrigger,
	RecipeInstallationUpdateRequest,
} from "@assistant/schemas";
import {
	deleteRecipeInstallation,
	installAssistantRecipe,
	invokeAssistantRecipe,
	listAssistantRecipes,
	listRecipeInstallations,
	updateRecipeInstallation,
} from "~/lib/api/recipes";

export const ASSISTANT_RECIPES_QUERY_KEY = ["assistant-recipes"] as const;
export const RECIPE_INSTALLATIONS_QUERY_KEY = ["recipe-installations"] as const;

export function useAssistantRecipes() {
	return useQuery({
		queryKey: ASSISTANT_RECIPES_QUERY_KEY,
		queryFn: listAssistantRecipes,
		staleTime: 5 * 60 * 1000,
	});
}

export function useInstallAssistantRecipe() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			recipeId,
			triggers,
			configuration,
		}: {
			recipeId: string;
			triggers?: RecipeInstallationTrigger[];
			configuration?: RecipeConfiguration;
		}) => installAssistantRecipe(recipeId, triggers, configuration),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: RECIPE_INSTALLATIONS_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY });
		},
	});
}

export function useInvokeAssistantRecipe() {
	return useMutation({
		mutationFn: ({ recipeId, input }: { recipeId: string; input?: string }) =>
			invokeAssistantRecipe(recipeId, input),
	});
}

export function useRecipeInstallations() {
	return useQuery({
		queryKey: RECIPE_INSTALLATIONS_QUERY_KEY,
		queryFn: listRecipeInstallations,
		staleTime: 60 * 1000,
	});
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
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: RECIPE_INSTALLATIONS_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY });
		},
	});
}

export function useDeleteRecipeInstallation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ installationId }: { installationId: string }) =>
			deleteRecipeInstallation(installationId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: RECIPE_INSTALLATIONS_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY });
		},
	});
}
