export function hasAnyEnabledTool(
  enabledTools: readonly string[] | undefined,
  ...toolIds: string[]
): boolean {
  const enabledToolSet = new Set(enabledTools || []);

  return toolIds.some((toolId) => enabledToolSet.has(toolId));
}

export function intersectGrantedIds(
  grantedIds: readonly string[],
  requestedIds: unknown,
): string[] {
  if (!Array.isArray(requestedIds)) {
    return [...grantedIds];
  }

  const granted = new Set<string>(grantedIds);

  return requestedIds.filter((id): id is string => typeof id === "string" && granted.has(id));
}

export function intersectEnabledTools(
  allowedTools: readonly string[],
  requestedTools: unknown,
): string[] {
  return intersectGrantedIds(allowedTools, requestedTools);
}

export function excludeEnabledTools(
  enabledTools: readonly string[],
  forbiddenTools: readonly string[] = [],
): string[] {
  const forbidden = new Set(forbiddenTools);

  return enabledTools.filter((tool) => !forbidden.has(tool));
}
