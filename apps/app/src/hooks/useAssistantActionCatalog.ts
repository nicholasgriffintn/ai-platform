import { useMemo } from "react";
import {
	buildAssistantActionCatalog,
	type AssistantActionCatalog,
} from "@ngriffin_uk/polychat-schemas";
import type { ModelToolDefinition } from "~/lib/model-tools";
import { useAgents } from "./useAgents";
import { useRecipeConnectors } from "./useConnectors";
import { useAssistantRecipes, useRecipeInstallations } from "./useRecipes";

export function useAssistantActionCatalog({
	includeAgents = true,
	modelTools = [],
	projectId,
}: {
	includeAgents?: boolean;
	modelTools?: readonly ModelToolDefinition[];
	projectId?: string;
} = {}): AssistantActionCatalog {
	const { chatAgents } = useAgents({ enabled: includeAgents });
	const { data: recipesData } = useAssistantRecipes();
	const { data: installationsData } = useRecipeInstallations(projectId);
	const { data: connectorsData } = useRecipeConnectors();

	return useMemo(
		() =>
			buildAssistantActionCatalog({
				agents: includeAgents ? chatAgents : [],
				connectors: connectorsData?.connectors ?? [],
				installations: installationsData?.installations ?? [],
				modelTools,
				recipes: recipesData?.recipes ?? [],
			}),
		[
			chatAgents,
			connectorsData?.connectors,
			includeAgents,
			installationsData?.installations,
			modelTools,
			recipesData?.recipes,
		],
	);
}
