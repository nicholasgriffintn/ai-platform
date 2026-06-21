import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { useAssistantRecipes, useRecipeInstallations } from "~/hooks/useRecipes";
import type { RecipeKindFilter } from "~/lib/recipes";
import { useRecipeWorkflows } from "./useRecipeWorkflows";

export function useRecipesPageController() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [kind, setKind] = useState<RecipeKindFilter>("all");
	const [category, setCategory] = useState("All");
	const [search, setSearch] = useState("");
	const { data, isLoading, error, refetch, isRefetching } = useAssistantRecipes();
	const { data: installationsData } = useRecipeInstallations();
	const workflows = useRecipeWorkflows();

	const recipes = data?.recipes ?? [];
	const categories = ["All", ...(data?.categories ?? [])];
	const filteredRecipes = useMemo(
		() =>
			recipes.filter((recipe) => {
				const matchesKind = kind === "all" || recipe.kind === kind;
				const matchesCategory = category === "All" || recipe.category === category;
				const query = search.trim().toLowerCase();
				const matchesSearch =
					!query ||
					[
						recipe.title,
						recipe.summary,
						recipe.description,
						recipe.category,
						...recipe.actions,
						...recipe.integrations.map((integration) => integration.name),
					]
						.join(" ")
						.toLowerCase()
						.includes(query);

				return matchesKind && matchesCategory && matchesSearch;
			}),
		[category, kind, recipes, search],
	);

	const automationCount = recipes.filter((recipe) => recipe.kind === "automate").length;
	const installationByRecipeId = useMemo(
		() =>
			new Map(
				(installationsData?.installations ?? []).map((installation) => [
					installation.recipeId,
					installation,
				]),
			),
		[installationsData?.installations],
	);
	const installedRecipeIds = useMemo(
		() => new Set(installationByRecipeId.keys()),
		[installationByRecipeId],
	);

	useEffect(() => {
		if (isLoading || searchParams.get("action") !== "schedule") {
			return;
		}

		const recipeId = searchParams.get("recipe");
		const recipe = recipeId ? recipes.find((item) => item.id === recipeId) : undefined;
		if (!recipe) {
			return;
		}

		workflows.actions.openScheduleDialog(recipe, installationByRecipeId.get(recipe.id));
		const nextSearchParams = new URLSearchParams(searchParams);
		nextSearchParams.delete("action");
		nextSearchParams.delete("recipe");
		setSearchParams(nextSearchParams, { replace: true });
	}, [
		installationByRecipeId,
		isLoading,
		recipes,
		searchParams,
		setSearchParams,
		workflows.actions,
	]);

	const clearFilters = () => {
		setSearch("");
		setKind("all");
		setCategory("All");
	};

	return {
		filters: {
			kind,
			category,
			search,
			categories,
			setKind,
			setCategory,
			setSearch,
			clearFilters,
		},
		recipes: {
			all: recipes,
			filtered: filteredRecipes,
			isLoading,
			error,
			refetch,
			isRefetching,
			automationCount,
			configuredCount: installedRecipeIds.size,
		},
		configurationDialog: workflows.configurationDialog,
		scheduleDialog: workflows.scheduleDialog,
		deleteDialog: workflows.deleteDialog,
		actions: {
			...workflows.actions,
			getRecipeCardState: (recipe: (typeof recipes)[number]) =>
				workflows.actions.getRecipeCardState(recipe, installationByRecipeId.get(recipe.id)),
		},
	};
}
