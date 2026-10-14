export function withProjectScope(path: string, projectId?: string): string {
  if (!projectId) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}project_id=${encodeURIComponent(projectId)}`;
}

export function withWorkspaceScope(path: string, workspaceId?: string): string {
  if (!workspaceId) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}workspace_id=${encodeURIComponent(workspaceId)}`;
}
