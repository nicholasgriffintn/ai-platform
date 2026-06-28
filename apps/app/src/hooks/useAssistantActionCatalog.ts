import { useMemo } from "react";
import { buildAssistantActionCatalog, type AssistantActionCatalog } from "@assistant/schemas";
import type { ModelToolDefinition } from "~/lib/model-tools";
import { useAgents } from "./useAgents";
import { useRecipeConnectors } from "./useConnectors";
import { useDynamicApps } from "./useDynamicApps";
import { useAssistantRecipes, useRecipeInstallations } from "./useRecipes";

export function useAssistantActionCatalog({
	includeApps = true,
	modelTools = [],
}: {
	includeApps?: boolean;
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
				apps: includeApps ? (appsData?.apps ?? []) : [],
				connectors: connectorsData?.connectors ?? [],
				installations: installationsData?.installations ?? [],
				modelTools,
				recipes: recipesData?.recipes ?? [],
			}),
		[
			appsData?.apps,
			chatAgents,
			connectorsData?.connectors,
			includeApps,
			installationsData?.installations,
			modelTools,
			recipesData?.recipes,
		],
	);
}
