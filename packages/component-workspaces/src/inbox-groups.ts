import { groupBy } from "@ngriffin_uk/polychat-utility-core";

export interface WorkPlaceNames {
  workspace: (workspaceId: string | null) => string;
  project: (projectId: string) => string;
}

export interface PlacedProjectGroup<T> {
  projectId: string | null;
  name: string;
  items: T[];
}

export interface PlacedWorkspaceGroup<T, W extends string | null = string | null> {
  workspaceId: W;
  name: string;
  count: number;
  projects: PlacedProjectGroup<T>[];
}

export function workPlaceNamesFrom(
  workspaces: readonly {
    id: string;
    name: string;
    projects: readonly { id: string; name: string }[];
  }[],
): WorkPlaceNames {
  const workspaceNames = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
  const projectNames = new Map(
    workspaces.flatMap((workspace) =>
      workspace.projects.map((project) => [project.id, project.name] as const),
    ),
  );

  return {
    workspace: (workspaceId) =>
      workspaceId ? (workspaceNames.get(workspaceId) ?? "Workspace") : "Personal",
    project: (projectId) => projectNames.get(projectId) ?? "Project",
  };
}

export function groupByPlace<T, W extends string | null>(
  items: readonly T[],
  placeOf: (item: T) => { workspaceId: W; projectId: string | null },
  names: WorkPlaceNames,
): PlacedWorkspaceGroup<T, W>[] {
  return [...groupBy(items, (item) => placeOf(item).workspaceId)].map(
    ([workspaceId, workspaceItems]) => ({
      workspaceId,
      name: names.workspace(workspaceId),
      count: workspaceItems.length,
      projects: [...groupBy(workspaceItems, (item) => placeOf(item).projectId)].map(
        ([projectId, projectItems]) => ({
          projectId,
          name: projectId ? names.project(projectId) : workspaceId ? "Workspace" : "Personal",
          items: projectItems,
        }),
      ),
    }),
  );
}

export function orderPersonal<T>(
  groups: readonly PlacedWorkspaceGroup<T>[],
  personalFirst: boolean,
): PlacedWorkspaceGroup<T>[] {
  const personal = groups.filter((group) => group.workspaceId === null);
  const workspaces = groups.filter((group) => group.workspaceId !== null);

  return personalFirst ? [...personal, ...workspaces] : [...workspaces, ...personal];
}
