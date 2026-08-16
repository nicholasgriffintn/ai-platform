import { useMemo } from "react";
import {
	buildAssistantActionCatalog,
	type AssistantActionCatalog,
} from "@ngriffin_uk/polychat-schemas";
import type { ModelToolDefinition } from "~/lib/model-tools";
import { useChatStore } from "~/state/stores/chatStore";
import { useAgents } from "./useAgents";
import { useCapabilityCatalog } from "./useCapabilityCatalog";
import { useRecipeConnectors } from "./useConnectors";
import { useAssistantRecipes, useRecipeInstallations } from "./useRecipes";
import { usePersonalSkills } from "./useSkills";

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
	const capabilityCatalog = useCapabilityCatalog(projectId);
	const isAuthenticated = useChatStore((state) => state.isAuthenticated);
	const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
	const { query: personalSkills } = usePersonalSkills(isAuthenticated && !projectId);
	const skills = useMemo(() => {
		if (projectId) return capabilityCatalog.data?.skills ?? [];
		if (isAuthenticationLoading) return [];
		if (isAuthenticated) {
			return personalSkills.data?.skills.filter((skill) => skill.state === "ready") ?? [];
		}
		return capabilityCatalog.data?.skills ?? [];
	}, [
		capabilityCatalog.data?.skills,
		isAuthenticated,
		isAuthenticationLoading,
		personalSkills.data?.skills,
		projectId,
	]);

	return useMemo(
		() =>
			buildAssistantActionCatalog({
				agents: includeAgents ? chatAgents : [],
				connectors: connectorsData?.connectors ?? [],
				installations: installationsData?.installations ?? [],
				modelTools,
				recipes: recipesData?.recipes ?? [],
				skills,
			}),
		[
			chatAgents,
			connectorsData?.connectors,
			includeAgents,
			installationsData?.installations,
			modelTools,
			recipesData?.recipes,
			skills,
		],
	);
}
