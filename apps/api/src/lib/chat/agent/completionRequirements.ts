import type { ChatCompletionParameters } from "~/types";
import { readOptionBag, readRecordOption } from "~/utils/options";
import { hasEnabledToolNames } from "~/utils/toolNames";

type AgentRequestParams = Pick<
	ChatCompletionParameters,
	"enabled_tools" | "options" | "tool_choice"
>;

export interface AgentCompletionRequirements {
	minToolCalls: number;
}

export function getAgentCompletionRequirements(
	requestParams: AgentRequestParams,
): AgentCompletionRequirements {
	const options = readOptionBag(requestParams.options);
	const agentOptions = readRecordOption(options, "agent");
	const minToolCalls =
		typeof agentOptions.minToolCalls === "number" &&
		Number.isInteger(agentOptions.minToolCalls) &&
		agentOptions.minToolCalls > 0
			? agentOptions.minToolCalls
			: 0;
	return {
		minToolCalls,
	};
}

export function buildInitialPlan(requirements: AgentCompletionRequirements): string {
	const lines = ["Use available tools as needed, then return a final answer."];
	if (requirements.minToolCalls > 0) {
		lines.push(
			`Do not finish until at least ${requirements.minToolCalls} tool call${
				requirements.minToolCalls === 1 ? "" : "s"
			} have completed.`,
		);
	}
	return lines.join("\n");
}

export function shouldRequireToolChoice(params: {
	requirements: AgentCompletionRequirements;
	commandCount: number;
	requestParams: AgentRequestParams;
}): boolean {
	return (
		params.requirements.minToolCalls > params.commandCount &&
		hasEnabledToolNames(params.requestParams.enabled_tools)
	);
}

export function buildContinuationInstruction(params: {
	requirements: AgentCompletionRequirements;
	commandCount: number;
}): string {
	const remainingToolCalls = Math.max(params.requirements.minToolCalls - params.commandCount, 0);
	const lines = [
		`The response is not final yet. Complete at least ${remainingToolCalls} more tool call${
			remainingToolCalls === 1 ? "" : "s"
		} before producing the final answer.`,
		"Call an enabled tool now, then use the tool result to continue the task.",
	];
	return lines.join("\n");
}

export function withRequiredToolChoice<RequestParams extends AgentRequestParams>(
	requestParams: RequestParams,
	requiresToolChoice: boolean,
): RequestParams {
	if (!requiresToolChoice) {
		return requestParams;
	}

	return {
		...requestParams,
		tool_choice: "required",
	};
}
