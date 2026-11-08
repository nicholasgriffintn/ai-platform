import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { DEFAULT_MAX_IDENTICAL_TOOL_CALLS } from "~/config/chat";

export type ToolCallLedger = Map<string, number>;

export const REPEATED_TOOL_CALL_NEXT =
  "Use the earlier result, call a different tool, or answer the user now.";

export const TOOL_TURN_LIMIT_NEXT =
  "Work from the results you already have, or answer the user now.";

export function createToolCallLedger(): ToolCallLedger {
  return new Map();
}

function normaliseToolCallArguments(rawArguments: unknown): string {
  if (rawArguments === undefined || rawArguments === null) {
    return "";
  }

  const fallback = typeof rawArguments === "string" ? rawArguments : "";
  const parsed = typeof rawArguments === "string" ? safeParseJson(rawArguments) : rawArguments;

  if (parsed === undefined || parsed === null) {
    return fallback;
  }

  try {
    return canonicalJson(parsed);
  } catch {
    return fallback;
  }
}

export function checkToolCallRepeat(
  ledger: ToolCallLedger,
  functionName: string,
  rawArguments: unknown,
  limit: number = DEFAULT_MAX_IDENTICAL_TOOL_CALLS,
): {
  repeated: boolean;
  attempts: number;
  record: () => void;
  recordDeterministicFailure: () => void;
} {
  const signature = `${functionName} ${normaliseToolCallArguments(rawArguments)}`;
  const attempts = ledger.get(signature) ?? 0;
  const effectiveLimit = Math.max(1, limit);

  if (attempts >= effectiveLimit) {
    return {
      repeated: true,
      attempts,
      record: () => undefined,
      recordDeterministicFailure: () => undefined,
    };
  }

  return {
    repeated: false,
    attempts,
    record: () => ledger.set(signature, (ledger.get(signature) ?? 0) + 1),
    recordDeterministicFailure: () => ledger.set(signature, effectiveLimit),
  };
}

export function buildRepeatedToolCallMessage(functionName: string, attempts: number): string {
  const occurrences = attempts === 1 ? "once" : `${attempts} times`;

  return `"${functionName}" has already run ${occurrences} in this response with these exact arguments, so running it again returns nothing new. Its result is already in this conversation.`;
}

export function checkToolCallTurnBudget(
  ledger: ToolCallLedger,
  functionName: string,
  limit: number | undefined,
): { allowed: boolean; claim: () => void } {
  const used = ledger.get(functionName) ?? 0;

  if (limit !== undefined && used >= Math.max(1, limit)) {
    return { allowed: false, claim: () => undefined };
  }

  return {
    allowed: true,
    claim: () => {
      if (limit !== undefined) {
        ledger.set(functionName, (ledger.get(functionName) ?? 0) + 1);
      }
    },
  };
}

export function buildToolTurnLimitMessage(functionName: string, limit: number): string {
  const allowance = limit === 1 ? "once" : `${limit} times`;

  return `"${functionName}" can run ${allowance} per response and that allowance is used up.`;
}
