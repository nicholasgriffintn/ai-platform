import { useMemo } from "react";
import {
	buildAssistantActionCatalog,
	createRecipeAssistantActionItem,
} from "@ngriffin_uk/polychat-schemas";

import { useAssistantRecipes } from "./useRecipes";
import { useDynamicApps } from "./useDynamicApps";
import { useTools } from "./useTools";

export function useProjectCapabilityCatalog() {
	const appsQuery = useDynamicApps();
	const recipesQuery = useAssistantRecipes();
	const toolsQuery = useTools();
	const callableTools = useMemo(() => toolsQuery.data ?? [], [toolsQuery.data]);
	const apps = useMemo(() => appsQuery.data?.apps ?? [], [appsQuery.data?.apps]);
	const recipes = recipesQuery.data?.recipes ?? [];
	const tools = appsQuery.data?.tools ?? [];

	const items = useMemo(() => {
		const baseCatalog = buildAssistantActionCatalog({
			apps,
			modelTools: tools,
			tools: callableTools,
		});
		return [
			...baseCatalog.items,
			...recipes.map((recipe) => createRecipeAssistantActionItem(recipe)),
		];
	}, [apps, callableTools, recipes, tools]);

	return {
		apps,
		error: appsQuery.error ?? recipesQuery.error ?? toolsQuery.error,
		experiences: appsQuery.data?.experiences ?? [],
		isLoading: appsQuery.isLoading || recipesQuery.isLoading || toolsQuery.isLoading,
		items,
		recipes,
		tools,
	};
}
