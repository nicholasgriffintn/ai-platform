export function mergeToolSelection(currentTools: string[], toolId: string): string[] {
	return currentTools.includes(toolId) ? currentTools : [...currentTools, toolId];
}
