import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export const TOOL_RESULT_NEXT_DATA_KEY = "toolResultNext";

export function readToolResultNext(data: unknown): string | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const next = data[TOOL_RESULT_NEXT_DATA_KEY];

  return typeof next === "string" && next.trim() ? next.trim() : undefined;
}

export function omitToolResultNext<T extends Record<string, unknown>>(data: T): T {
  if (!(TOOL_RESULT_NEXT_DATA_KEY in data)) {
    return data;
  }

  const visible = { ...data };

  delete visible[TOOL_RESULT_NEXT_DATA_KEY];

  return visible;
}

export function appendToolResultNext(text: string, next: string | undefined): string {
  const hint = next?.trim();

  return hint ? `${text}\n\nNext: ${hint}` : text;
}
