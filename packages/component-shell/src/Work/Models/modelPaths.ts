export function modelsPath(workspaceId: string, projectId?: string): string {
  return projectId
    ? `/work/${workspaceId}/projects/${projectId}/models`
    : `/work/${workspaceId}/models`;
}

export function modelVersionPath(
  workspaceId: string,
  versionId: string,
  projectId?: string,
): string {
  const base = `/work/${workspaceId}/models/versions/${versionId}`;

  return projectId ? `${base}?projectId=${encodeURIComponent(projectId)}` : base;
}
