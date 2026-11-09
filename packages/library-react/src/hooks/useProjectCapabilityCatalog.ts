import {
  buildAssistantActionCatalog,
  createRecipeAssistantActionItem,
  type ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

import { getExperienceCapabilityId } from "../lib/app-addresses.js";
import { useCapabilityCatalog } from "./useCapabilityCatalog.js";
import { useAssistantRecipes } from "./useRecipes.js";
import { useRemoteApps } from "./useRemoteApps.js";
import { useTools } from "./useTools.js";

function toEnableableApp(experience: ProjectExperienceDefinition) {
  return {
    id: getExperienceCapabilityId(experience),
    name: experience.name,
    description: experience.description,
    category: experience.category,
    icon: experience.icon,
    theme: experience.theme,
    tags: experience.tags,
    type: experience.type,
    kind: "frontend" as const,
    featured: true,
  };
}

export function useProjectCapabilityCatalog(projectId?: string) {
  const catalogQuery = useCapabilityCatalog(projectId);
  const recipesQuery = useAssistantRecipes();
  const toolsQuery = useTools({ projectId });
  const callableTools = useMemo(() => toolsQuery.data ?? [], [toolsQuery.data]);
  const remoteAppsQuery = useRemoteApps({ enabled: !projectId });
  const experiences = useMemo<ProjectExperienceDefinition[]>(
    () => [
      ...(catalogQuery.data?.experiences ?? []),
      ...(projectId ? [] : (remoteAppsQuery.data ?? [])),
    ],
    [catalogQuery.data?.experiences, projectId, remoteAppsQuery.data],
  );
  const apps = useMemo(
    () =>
      experiences
        .filter((experience) => !projectId || experience.scope !== "personal")
        .map(toEnableableApp),
    [experiences, projectId],
  );
  const recipes = useMemo(() => recipesQuery.data?.recipes ?? [], [recipesQuery.data?.recipes]);
  const modelTools = useMemo(
    () => catalogQuery.data?.modelTools ?? [],
    [catalogQuery.data?.modelTools],
  );
  const skills = useMemo(() => catalogQuery.data?.skills ?? [], [catalogQuery.data?.skills]);
  const teammates = useMemo(
    () => catalogQuery.data?.teammates ?? [],
    [catalogQuery.data?.teammates],
  );

  const items = useMemo(() => {
    const baseCatalog = buildAssistantActionCatalog({
      teammates,
      apps,
      modelTools,
      skills,
      tools: callableTools,
    });

    return [
      ...baseCatalog.items,
      ...recipes.map((recipe) => createRecipeAssistantActionItem(recipe)),
    ];
  }, [teammates, apps, callableTools, recipes, modelTools, skills]);

  return {
    apps,
    error: catalogQuery.error ?? recipesQuery.error ?? toolsQuery.error,
    experiences,
    isLoading: catalogQuery.isLoading || recipesQuery.isLoading || toolsQuery.isLoading,
    items,
    recipes,
    skills,
    tools: modelTools,
  };
}
