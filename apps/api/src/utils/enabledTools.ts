export function hasAnyEnabledTool(
  enabledTools: readonly string[] | undefined,
  ...toolIds: string[]
): boolean {
  const enabledToolSet = new Set(enabledTools || []);

  return toolIds.some((toolId) => enabledToolSet.has(toolId));
}

export function intersectEnabledTools(
  allowedTools: readonly string[],
  requestedTools: unknown,
): string[] {
  if (!Array.isArray(requestedTools)) {
    return [...allowedTools];
  }

  const allowed = new Set(allowedTools);

  return requestedTools.filter(
    (tool): tool is string => typeof tool === "string" && allowed.has(tool),
  );
}
