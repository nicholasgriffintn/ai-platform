import type { SetupPlan } from "@ngriffin_uk/polychat-schemas";

type Initiative = SetupPlan["initiatives"][number];
type Project = SetupPlan["projects"][number];
type Teammate = SetupPlan["teammates"][number];
type Task = SetupPlan["tasks"][number];

export function patchSetupInitiative(
  plan: SetupPlan,
  key: string,
  patch: Partial<Initiative>,
): SetupPlan {
  return {
    ...plan,
    initiatives: plan.initiatives.map((initiative) =>
      initiative.key === key ? { ...initiative, ...patch } : initiative,
    ),
  };
}

export function patchSetupProject(
  plan: SetupPlan,
  key: string,
  patch: Partial<Project>,
): SetupPlan {
  return {
    ...plan,
    projects: plan.projects.map((project) =>
      project.key === key ? { ...project, ...patch } : project,
    ),
  };
}

export function patchSetupTeammate(
  plan: SetupPlan,
  key: string,
  patch: Partial<Teammate>,
): SetupPlan {
  return {
    ...plan,
    teammates: plan.teammates.map((teammate) =>
      teammate.key === key ? { ...teammate, ...patch } : teammate,
    ),
  };
}

export function patchSetupTask(plan: SetupPlan, index: number, patch: Partial<Task>): SetupPlan {
  return {
    ...plan,
    tasks: plan.tasks.map((task, position) => (position === index ? { ...task, ...patch } : task)),
  };
}

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
