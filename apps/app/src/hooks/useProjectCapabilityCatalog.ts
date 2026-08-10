import { useMemo } from "react";
import { buildAssistantActionCatalog, createRecipeAssistantActionItem } from "@assistant/schemas";

import { useAssistantRecipes } from "./useRecipes";
import { useDynamicApps } from "./useDynamicApps";

export function useProjectCapabilityCatalog() {
	const appsQuery = useDynamicApps();
	const recipesQuery = useAssistantRecipes();
	const apps = appsQuery.data?.apps ?? [];
	const recipes = recipesQuery.data?.recipes ?? [];
	const tools = appsQuery.data?.tools ?? [];

	const items = useMemo(() => {
		const baseCatalog = buildAssistantActionCatalog({ apps, modelTools: tools });
		return [
			...baseCatalog.items,
			...recipes.map((recipe) => createRecipeAssistantActionItem(recipe)),
		];
	}, [apps, recipes, tools]);

	return {
		apps,
		error: appsQuery.error ?? recipesQuery.error,
		experiences: appsQuery.data?.experiences ?? [],
		isLoading: appsQuery.isLoading || recipesQuery.isLoading,
		items,
		recipes,
		tools,
	};
}
