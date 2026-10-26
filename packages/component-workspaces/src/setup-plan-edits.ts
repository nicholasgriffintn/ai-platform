import type { SetupPlan } from "@ngriffin_uk/polychat-schemas";

export function removeSetupInitiative(plan: SetupPlan, key: string): SetupPlan {
  return {
    ...plan,
    initiatives: plan.initiatives.filter((initiative) => initiative.key !== key),
    projects: plan.projects.map((project) =>
      project.initiative === key ? { ...project, initiative: null } : project,
    ),
  };
}

export function removeSetupProject(plan: SetupPlan, key: string): SetupPlan {
  return {
    ...plan,
    projects: plan.projects.filter((project) => project.key !== key),
    tasks: plan.tasks.filter((task) => task.project !== key),
    teammates: plan.teammates.map((teammate) => ({
      ...teammate,
      projects: teammate.projects.filter((project) => project !== key),
    })),
    connectors: plan.connectors.flatMap((connector) => {
      const projects = connector.projects.filter((project) => project !== key);

      return projects.length ? [{ ...connector, projects }] : [];
    }),
  };
}

export function removeSetupTeammate(plan: SetupPlan, key: string): SetupPlan {
  return {
    ...plan,
    teammates: plan.teammates
      .filter((teammate) => teammate.key !== key)
      .map((teammate) =>
        teammate.reportsTo === key ? { ...teammate, reportsTo: null } : teammate,
      ),
    tasks: plan.tasks.map((task) => (task.owner === key ? { ...task, owner: null } : task)),
  };
}

export function removeSetupTask(plan: SetupPlan, index: number): SetupPlan {
  return { ...plan, tasks: plan.tasks.filter((_task, position) => position !== index) };
}

export function removeSetupConnector(plan: SetupPlan, provider: string): SetupPlan {
  return {
    ...plan,
    connectors: plan.connectors.filter((connector) => connector.provider !== provider),
  };
}

export function removeSetupSuggestion(plan: SetupPlan, provider: string): SetupPlan {
  return {
    ...plan,
    suggestions: plan.suggestions.filter((suggestion) => suggestion.provider !== provider),
  };
}
