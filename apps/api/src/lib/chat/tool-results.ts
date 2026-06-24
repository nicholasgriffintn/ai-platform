import type { Message } from "~/types";

const SUCCESSFUL_TOOL_STATUSES = new Set(["success", "completed"]);

export interface ToolCallResultReference {
	id?: string;
	name?: string;
	function?: {
		name?: string;
	};
}

function getToolCallName(toolCall: ToolCallResultReference): string | undefined {
	return toolCall.function?.name || toolCall.name;
}

export function isSuccessfulToolStatus(status: string | null | undefined): boolean {
	return SUCCESSFUL_TOOL_STATUSES.has(status || "");
}

function isContinuableToolResult(message: Message): boolean {
	if (isSuccessfulToolStatus(message.status)) {
		return true;
	}

	if (
		(message.status === "needs_correction" || message.status === "error") &&
		message.data?.recoverable === true
	) {
		return true;
	}

	return false;
}

export function getFinalToolResultsForCalls(
	toolCalls: ToolCallResultReference[],
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
	toolCalls: ToolCallResultReference[],
	toolResults: Message[],
): boolean {
	if (toolCalls.length === 0) {
		return false;
	}

	const finalResults = getFinalToolResultsForCalls(toolCalls, toolResults);
	return (
		finalResults.length === toolCalls.length &&
		finalResults.every((message) => isContinuableToolResult(message))
	);
}
