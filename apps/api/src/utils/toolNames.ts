export interface ToolDefinitionLike {
	[key: string]: unknown;
	name?: unknown;
	function?: {
		name?: unknown;
	} | null;
}

export function getToolDefinitionName(
	tool: ToolDefinitionLike | null | undefined,
): string | undefined {
	if (typeof tool?.name === "string") {
		return tool.name;
	}

	if (typeof tool?.function?.name === "string") {
		return tool.function.name;
	}

	return undefined;
}

export function mergeToolDefinitionsByName<Tool extends ToolDefinitionLike>(
	...toolGroups: ReadonlyArray<ReadonlyArray<Tool>>
): Tool[] {
	const toolNames = new Set<string>();
	const mergedTools: Tool[] = [];

	for (const group of toolGroups) {
		for (const tool of group) {
			const name = getToolDefinitionName(tool);
			if (name && toolNames.has(name)) {
				continue;
			}

			if (name) {
				toolNames.add(name);
			}

			mergedTools.push(tool);
		}
	}

	return mergedTools;
}

export function hasEnabledToolNames(enabledTools: unknown): boolean {
	return (
		Array.isArray(enabledTools) &&
		enabledTools.some((toolName) => typeof toolName === "string" && toolName.trim().length > 0)
	);
}
