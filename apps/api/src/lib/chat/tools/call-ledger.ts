import { canonicalJson } from "~/utils/canonical-json";
import { safeParseJson } from "~/utils/json";

export const DEFAULT_MAX_IDENTICAL_TOOL_CALLS = 3;

export type ToolCallLedger = Map<string, number>;

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
): { repeated: boolean; attempts: number; record: () => void } {
  const signature = `${functionName} ${normaliseToolCallArguments(rawArguments)}`;
  const attempts = ledger.get(signature) ?? 0;

  if (attempts >= Math.max(1, limit)) {
    return { repeated: true, attempts, record: () => undefined };
  }

  return {
    repeated: false,
    attempts,
    record: () => ledger.set(signature, (ledger.get(signature) ?? 0) + 1),
  };
}

export function buildRepeatedToolCallMessage(functionName: string, attempts: number): string {
  const occurrences = attempts === 1 ? "once" : `${attempts} times`;

  return `"${functionName}" has already run ${occurrences} in this response with these exact arguments, so running it again returns nothing new. Its result is already in this conversation: use that, call a different tool, or answer the user now.`;
}
