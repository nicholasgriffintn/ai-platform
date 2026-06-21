import { useMemo } from "react";
import type { AssistantActionCatalog } from "@assistant/schemas";

import { buildAssistantActionCatalog } from "~/lib/assistant-actions";
import type { ModelToolDefinition } from "~/lib/model-tools";
import { useAgents } from "./useAgents";
import { useRecipeConnectors } from "./useConnectors";
import { useDynamicApps } from "./useDynamicApps";
import { useAssistantRecipes, useRecipeInstallations } from "./useRecipes";

export function useAssistantActionCatalog({
	modelTools = [],
}: {
	modelTools?: readonly ModelToolDefinition[];
} = {}): AssistantActionCatalog {
	const { chatAgents } = useAgents();
	const { data: recipesData } = useAssistantRecipes();
	const { data: installationsData } = useRecipeInstallations();
	const { data: appsData } = useDynamicApps();
	const { data: connectorsData } = useRecipeConnectors();

	return useMemo(
		() =>
			buildAssistantActionCatalog({
				agents: chatAgents,
				apps: appsData?.apps ?? [],
				connectors: connectorsData?.connectors ?? [],
				installations: installationsData?.installations ?? [],
				modelTools,
				recipes: recipesData?.recipes ?? [],
			}),
		[
			appsData?.apps,
			chatAgents,
			connectorsData?.connectors,
			installationsData?.installations,
			modelTools,
			recipesData?.recipes,
		],
	);
}
