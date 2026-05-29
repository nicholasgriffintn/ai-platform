export type ToolCallsArray = Record<string, any>[];

export function hasToolCalls(toolCalls: unknown): toolCalls is ToolCallsArray {
	return Array.isArray(toolCalls) && toolCalls.length > 0;
}

export function nonEmptyToolCallsOrNull(toolCalls: unknown): ToolCallsArray | null {
	return hasToolCalls(toolCalls) ? toolCalls : null;
}
