import type { AgentMessage } from "@assistant/agent-core";

import type { AgentCompletionRequirements } from "~/lib/chat/agent/completionRequirements";
import { hasEnabledToolNames } from "~/utils/toolNames";

export const DEFAULT_AGENT_MAX_STEPS = 8;

const REQUIRED_TOOL_CALL_EXTENSION_STEPS = 2;
const TOOL_RESULT_FINALISATION_EXTENSION_STEPS = 4;

export interface AgentStepBudgetExtensionInput {
	enabledTools: unknown;
	requirements: AgentCompletionRequirements;
	commandCount: number;
	messages: AgentMessage[];
}

export function resolveAgentStepBudgetExtension(
	input: AgentStepBudgetExtensionInput,
): { extendBy: number; reason: string } | null {
	if (!hasEnabledToolNames(input.enabledTools)) {
		return null;
	}

	const remainingRequiredToolCalls = Math.max(
		input.requirements.minToolCalls - input.commandCount,
		0,
	);
	if (remainingRequiredToolCalls > 0) {
		return {
			extendBy: Math.max(
				REQUIRED_TOOL_CALL_EXTENSION_STEPS,
				remainingRequiredToolCalls * REQUIRED_TOOL_CALL_EXTENSION_STEPS,
			),
			reason: "Agent step budget extended because required tool calls are still pending.",
		};
	}

	const latestMessage = input.messages[input.messages.length - 1];
	if (latestMessage?.role === "tool") {
		return {
			extendBy: TOOL_RESULT_FINALISATION_EXTENSION_STEPS,
			reason: "Agent step budget extended so the model can finish after tool progress.",
		};
	}

	return null;
}
