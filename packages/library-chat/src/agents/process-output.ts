import type { DesktopStreamEvent } from "@ngriffin_uk/polychat-schemas";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nestedText(value: unknown, depth = 0): string | undefined {
  const direct = stringValue(value);

  if (direct || depth >= 4) {
    return direct;
  }

  if (Array.isArray(value)) {
    const text = value
      .map((item) => nestedText(item, depth + 1))
      .filter((item): item is string => Boolean(item))
      .join("");

    return text || undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of [
    "delta",
    "text",
    "content",
    "result",
    "message",
    "item",
    "part",
    "params",
    "update",
  ]) {
    const text = nestedText(value[key], depth + 1);

    if (text) {
      return text;
    }
  }

  return undefined;
}

export function parseAgentProcessOutput(runId: string, line: string): DesktopStreamEvent {
  try {
    const parsed: unknown = JSON.parse(line);

    if (isRecord(parsed)) {
      const delta = nestedText(parsed);

      if (delta) {
        return { type: "text", runId, delta };
      }

      const type = stringValue(parsed.type);

      if (type) {
        return { type: "text", runId, delta: `[${type}]\n` };
      }
    }
  } catch {
    return { type: "text", runId, delta: `${line}\n` };
  }

  return { type: "text", runId, delta: `${line}\n` };
}
