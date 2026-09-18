import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export type ToolCallsArray = Record<string, any>[];

export function hasToolCalls(toolCalls: unknown): toolCalls is ToolCallsArray {
  return Array.isArray(toolCalls) && toolCalls.length > 0;
}

export function nonEmptyToolCallsOrNull(toolCalls: unknown): ToolCallsArray | null {
  return hasToolCalls(toolCalls) ? toolCalls : null;
}

export function serialiseToolCallArguments(
  argumentsValue: string | Record<string, unknown> | undefined,
): string | null {
  if (!argumentsValue) {
    return null;
  }

  return typeof argumentsValue === "string" ? argumentsValue : JSON.stringify(argumentsValue);
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

export function parseToolCallArguments(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
