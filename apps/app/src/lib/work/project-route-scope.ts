export function requireProjectRouteScope<T extends { workspaceId: string }>(
  project: T,
  workspaceId?: string,
): T {
  if (workspaceId && project.workspaceId !== workspaceId) {
    throw new Error("Project not found in this workspace");
  }

  return project;
}
