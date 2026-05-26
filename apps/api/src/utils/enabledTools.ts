export function hasAnyEnabledTool(
	enabledTools: readonly string[] | undefined,
	...toolIds: string[]
): boolean {
	const enabledToolSet = new Set(enabledTools || []);
	return toolIds.some((toolId) => enabledToolSet.has(toolId));
}
