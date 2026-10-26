export function projectTaskLink(workspaceId: string, projectId: string, taskId: string): string {
  return `/work/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`;
}
