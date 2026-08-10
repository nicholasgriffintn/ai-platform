import { useMemo } from "react";
import { buildAssistantActionCatalog, type AssistantActionCatalog } from "@assistant/schemas";
import type { ModelToolDefinition } from "~/lib/model-tools";
import { useAgents } from "./useAgents";
import { useRecipeConnectors } from "./useConnectors";
import { useAssistantRecipes, useRecipeInstallations } from "./useRecipes";

export function useAssistantActionCatalog({
	modelTools = [],
}: {
	modelTools?: readonly ModelToolDefinition[];
} = {}): AssistantActionCatalog {
	const { chatAgents } = useAgents();
	const { data: recipesData } = useAssistantRecipes();
	const { data: installationsData } = useRecipeInstallations();
	const { data: connectorsData } = useRecipeConnectors();

	return useMemo(
		() =>
			buildAssistantActionCatalog({
				agents: chatAgents,
				connectors: connectorsData?.connectors ?? [],
				installations: installationsData?.installations ?? [],
				modelTools,
				recipes: recipesData?.recipes ?? [],
			}),
		[
			chatAgents,
			connectorsData?.connectors,
			installationsData?.installations,
			modelTools,
			recipesData?.recipes,
		],
	);
}
