import type { ModelToolDefinition } from "@ngriffin_uk/polychat-library-chat/model-tools";
import {
  buildAssistantActionCatalog,
  type AssistantActionCatalog,
} from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

import { useChatStore } from "~/state/stores/chatStore";

import { useCapabilityCatalog } from "./useCapabilityCatalog";
import { useRecipeConnectors } from "./useConnectors";
import { useAssistantRecipes, useRecipeInstallations } from "./useRecipes";
import { usePersonalSkills } from "./useSkills";

export function useAssistantActionCatalog({
  includeTeammates = true,
  modelTools = [],
  projectId,
}: {
  includeTeammates?: boolean;
  modelTools?: readonly ModelToolDefinition[];
  projectId?: string;
} = {}): AssistantActionCatalog {
  const { data: recipesData } = useAssistantRecipes();
  const { data: installationsData } = useRecipeInstallations(projectId);
  const { data: connectorsData } = useRecipeConnectors();
  const capabilityCatalog = useCapabilityCatalog(projectId);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const { query: personalSkills } = usePersonalSkills(isAuthenticated && !projectId);
  const skills = useMemo(() => {
    if (projectId) {
      return capabilityCatalog.data?.skills ?? [];
    }

    if (isAuthenticationLoading) {
      return [];
    }

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

  const teammates = useMemo(
    () => (includeTeammates ? (capabilityCatalog.data?.teammates ?? []) : []),
    [capabilityCatalog.data?.teammates, includeTeammates],
  );

  return useMemo(
    () =>
      buildAssistantActionCatalog({
        teammates,
        connectors: connectorsData?.connectors ?? [],
        installations: installationsData?.installations ?? [],
        modelTools,
        recipes: recipesData?.recipes ?? [],
        skills,
      }),
    [
      teammates,
      connectorsData?.connectors,
      installationsData?.installations,
      modelTools,
      recipesData?.recipes,
      skills,
    ],
  );
}
