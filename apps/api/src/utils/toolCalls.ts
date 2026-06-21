export type ToolCallsArray = Record<string, any>[];

export function hasToolCalls(toolCalls: unknown): toolCalls is ToolCallsArray {
	return Array.isArray(toolCalls) && toolCalls.length > 0;
}

export function nonEmptyToolCallsOrNull(toolCalls: unknown): ToolCallsArray | null {
	return hasToolCalls(toolCalls) ? toolCalls : null;
}

export function hasToolCallNamed(toolCalls: unknown, toolName: string): boolean {
	if (!hasToolCalls(toolCalls)) {
		return false;
	}

	return toolCalls.some((toolCall) => {
		const functionName = toolCall.function?.name || toolCall.name;
		return functionName === toolName;
	});
}
