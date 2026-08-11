import { useMemo } from "react";
import { buildAssistantActionCatalog, createRecipeAssistantActionItem } from "@assistant/schemas";

import { useAssistantRecipes } from "./useRecipes";
import { useDynamicApps } from "./useDynamicApps";
import { useTools } from "./useTools";

export function useProjectCapabilityCatalog() {
	const appsQuery = useDynamicApps();
	const recipesQuery = useAssistantRecipes();
	const toolsQuery = useTools();
	const callableTools = useMemo(() => toolsQuery.data ?? [], [toolsQuery.data]);
	const callableToolIds = useMemo(
		() => new Set(callableTools.map((tool) => tool.id)),
		[callableTools],
	);
	const apps = useMemo(
		() => (appsQuery.data?.apps ?? []).filter((app) => !callableToolIds.has(app.id)),
		[appsQuery.data?.apps, callableToolIds],
	);
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
