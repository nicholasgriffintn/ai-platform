import type { ToolEffectClass } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

export interface UnsettledToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface InterruptedCallSettlement {
  outcome: "not_applied" | "unknown";
  content: string;
}

function parseStoredJson(value: unknown): unknown {
  return typeof value === "string" ? safeParseJson<unknown>(value) : value;
}

function readToolCall(value: unknown): UnsettledToolCall | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id) {
    return null;
  }

  const fn = isRecord(value.function) ? value.function : null;
  const name = typeof fn?.name === "string" ? fn.name : value.name;

  if (typeof name !== "string" || !name) {
    return null;
  }

  return { id: value.id, name, arguments: fn ? fn.arguments : value.arguments };
}

export function findUnsettledToolCalls(
  rows: readonly Record<string, unknown>[],
): UnsettledToolCall[] {
  const settled = new Set(
    rows.flatMap((row) =>
      row.role === "tool" && typeof row.tool_call_id === "string" ? [row.tool_call_id] : [],
    ),
  );
  const calls = rows.flatMap((row) => {
    if (row.role !== "assistant") {
      return [];
    }

    const toolCalls = parseStoredJson(row.tool_calls);

    return Array.isArray(toolCalls) ? toolCalls.flatMap((call) => readToolCall(call) ?? []) : [];
  });

  return calls.filter((call) => !settled.has(call.id));
}

export function settleInterruptedCall(
  name: string,
  effectClass: ToolEffectClass,
): InterruptedCallSettlement {
  if (effectClass === "read") {
    return {
      outcome: "not_applied",
      content: `${name} was interrupted before it returned. It only reads, so call it again if you still need the result.`,
    };
  }

  return {
    outcome: "unknown",
    content: `${name} was interrupted before its result was recorded, so it may or may not have taken effect. Check whether it did before repeating it, and say so in your result if you cannot tell.`,
  };
}
