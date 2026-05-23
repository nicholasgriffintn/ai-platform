import type { Message, ToolCall } from "~/types";

const SUCCESSFUL_TOOL_STATUSES = new Set(["success", "completed"]);

function getToolCallName(toolCall: ToolCall): string | undefined {
	return toolCall.function?.name;
}

export function isSuccessfulToolStatus(status: string | null | undefined): boolean {
	return SUCCESSFUL_TOOL_STATUSES.has(status || "");
}

export function getFinalToolResultsForCalls(
	toolCalls: ToolCall[],
	toolResults: Message[],
): Message[] {
	return toolCalls.flatMap((toolCall) => {
		const toolName = getToolCallName(toolCall);
		const result = toolResults
			.slice()
			.reverse()
			.find((message) => message.tool_call_id === toolCall.id && message.name === toolName);

		return result ? [result] : [];
	});
}

export function shouldContinueAfterToolResults(
	toolCalls: ToolCall[],
	toolResults: Message[],
): boolean {
	if (toolCalls.length === 0) {
		return false;
	}

	const finalResults = getFinalToolResultsForCalls(toolCalls, toolResults);
	return (
		finalResults.length === toolCalls.length &&
		finalResults.every((message) => isSuccessfulToolStatus(message.status))
	);
}
