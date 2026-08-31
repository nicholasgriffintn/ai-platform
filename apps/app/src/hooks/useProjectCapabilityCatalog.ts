import {
  buildAssistantActionCatalog,
  createRecipeAssistantActionItem,
  type ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

import { useCapabilityCatalog } from "./useCapabilityCatalog";
import { useAssistantRecipes } from "./useRecipes";
import { useTools } from "./useTools";

/**
 * An experience that declares an owning capability is the thing a project or person enables,
 * so it is presented as an app in the capability library.
 */
function toEnableableApp(experience: ProjectExperienceDefinition) {
  if (experience.requirement.kind !== "capability") {
    return null;
  }

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

export function useProjectCapabilityCatalog(projectId?: string) {
  const catalogQuery = useCapabilityCatalog(projectId);
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
  const recipes = useMemo(() => recipesQuery.data?.recipes ?? [], [recipesQuery.data?.recipes]);
  const modelTools = useMemo(
    () => catalogQuery.data?.modelTools ?? [],
    [catalogQuery.data?.modelTools],
  );
  const skills = useMemo(() => catalogQuery.data?.skills ?? [], [catalogQuery.data?.skills]);
  const agents = useMemo(() => catalogQuery.data?.agents ?? [], [catalogQuery.data?.agents]);

  const items = useMemo(() => {
    const baseCatalog = buildAssistantActionCatalog({
      agents,
      apps,
      modelTools,
      skills,
      tools: callableTools,
    });

    return [
      ...baseCatalog.items,
      ...recipes.map((recipe) => createRecipeAssistantActionItem(recipe)),
    ];
  }, [agents, apps, callableTools, recipes, modelTools, skills]);

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
