import { useMemo } from "react";
import {
	buildAssistantActionCatalog,
	createRecipeAssistantActionItem,
	type ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";

import { useAssistantRecipes } from "./useRecipes";
import { useCapabilityCatalog } from "./useCapabilityCatalog";
import { useTools } from "./useTools";

/**
 * An experience that declares an owning capability is the thing a project or person enables,
 * so it is presented as an app in the capability library.
 */
function toEnableableApp(experience: ProjectExperienceDefinition) {
	if (experience.requirement.kind !== "capability") return null;

	return {
		id: experience.requirement.capabilityId,
		name: experience.name,
		description: experience.description,
		category: experience.category,
		icon: experience.icon,
		theme: experience.theme,
		tags: experience.tags,
		type: experience.type,
		href: experience.href,
		kind: "frontend" as const,
		featured: true,
	};
}

export function useProjectCapabilityCatalog() {
	const catalogQuery = useCapabilityCatalog();
	const recipesQuery = useAssistantRecipes();
	const toolsQuery = useTools();
	const callableTools = useMemo(() => toolsQuery.data ?? [], [toolsQuery.data]);
	const experiences = useMemo(
		() => catalogQuery.data?.experiences ?? [],
		[catalogQuery.data?.experiences],
	);
	const apps = useMemo(
		() => experiences.map(toEnableableApp).filter((app) => app !== null),
		[experiences],
	);
	const recipes = recipesQuery.data?.recipes ?? [];
	const modelTools = catalogQuery.data?.modelTools ?? [];

	const items = useMemo(() => {
		const baseCatalog = buildAssistantActionCatalog({
			apps,
			modelTools,
			tools: callableTools,
		});
		return [
			...baseCatalog.items,
			...recipes.map((recipe) => createRecipeAssistantActionItem(recipe)),
		];
	}, [apps, callableTools, recipes, modelTools]);

	return {
		apps,
		error: catalogQuery.error ?? recipesQuery.error ?? toolsQuery.error,
		experiences,
		isLoading: catalogQuery.isLoading || recipesQuery.isLoading || toolsQuery.isLoading,
		items,
		recipes,
		tools: modelTools,
	};
}
