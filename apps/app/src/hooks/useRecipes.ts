import { useMutation, useQuery } from "@tanstack/react-query";
import { installAssistantRecipe, listAssistantRecipes } from "~/lib/api/recipes";

export function useAssistantRecipes() {
	return useQuery({
		queryKey: ["assistant-recipes"],
		queryFn: listAssistantRecipes,
		staleTime: 5 * 60 * 1000,
	});
}

export function useInstallAssistantRecipe() {
	return useMutation({
		mutationFn: installAssistantRecipe,
	});
}
