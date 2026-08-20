import {
  getFinalToolResultsForCalls,
  isContinuableToolResult,
  isSuccessfulToolStatus,
} from "~/lib/chat/tool-results";
import type { Message } from "~/types";

const CAPABILITY_DISCOVERY_TOOL_NAME = "discover_capabilities";
const CAPABILITY_DISCOVERY_MAX_STEPS = 4;

export type TurnContinuationReason =
  | "within-budget"
  | "budget-exhausted"
  | "unknown-tool-recovery"
  | "awaiting-tool-result"
  | "no-tool-calls";

export interface TurnContinuationInput {
  toolCalls: { id?: string }[];
  toolResults: Message[];
  currentStep: number;
  maxSteps?: number;
  unknownToolRecoveryUsed: boolean;
}

export interface TurnContinuationDecision {
  shouldContinue: boolean;
  reason: TurnContinuationReason;
  maxSteps: number;
  unknownToolRecoveryUsed: boolean;
}

function resolveMaxSteps(
  configuredMaxSteps: number | undefined,
  toolCalls: TurnContinuationInput["toolCalls"],
  toolResults: Message[],
): number {
  if (typeof configuredMaxSteps === "number") {
    return configuredMaxSteps;
  }

  const completedDiscovery = getFinalToolResultsForCalls(toolCalls, toolResults).some(
    (message) =>
      message.name === CAPABILITY_DISCOVERY_TOOL_NAME && isSuccessfulToolStatus(message.status),
  );

  return completedDiscovery ? CAPABILITY_DISCOVERY_MAX_STEPS : 1;
}

/**
 * The single rule for "should this turn keep going after tool results".
 * Both the agent loop and the streaming transport ask this, so the stopping
 * behaviour cannot drift between them.
 */
export function evaluateTurnContinuation(input: TurnContinuationInput): TurnContinuationDecision {
  const recoveredUnknownTool = input.toolResults.some(
    (message) => message.data?.errorCode === "UNKNOWN_TOOL" && message.data?.recoverable === true,
  );
  const unknownToolRecoveryUsed = input.unknownToolRecoveryUsed || recoveredUnknownTool;
  const maxSteps = resolveMaxSteps(input.maxSteps, input.toolCalls, input.toolResults);

  if (input.toolCalls.length === 0) {
    return {
      shouldContinue: false,
      reason: "no-tool-calls",
      maxSteps,
      unknownToolRecoveryUsed,
    };
  }

  const finalResults = getFinalToolResultsForCalls(input.toolCalls, input.toolResults);
  const allResultsContinuable =
    finalResults.length === input.toolCalls.length &&
    finalResults.every((message) => isContinuableToolResult(message));

  if (!allResultsContinuable) {
    return {
      shouldContinue: false,
      reason: "awaiting-tool-result",
      maxSteps,
      unknownToolRecoveryUsed,
    };
  }

  if (input.currentStep < maxSteps) {
    return {
      shouldContinue: true,
      reason: "within-budget",
      maxSteps,
      unknownToolRecoveryUsed,
    };
  }

  if (recoveredUnknownTool && !input.unknownToolRecoveryUsed) {
    return {
      shouldContinue: true,
      reason: "unknown-tool-recovery",
      maxSteps,
      unknownToolRecoveryUsed,
    };
  }

  return {
    shouldContinue: false,
    reason: "budget-exhausted",
    maxSteps,
    unknownToolRecoveryUsed,
  };
}
