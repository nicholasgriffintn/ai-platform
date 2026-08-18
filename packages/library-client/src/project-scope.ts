export function withProjectScope(path: string, projectId?: string): string {
  if (!projectId) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}projectId=${encodeURIComponent(projectId)}`;
}
