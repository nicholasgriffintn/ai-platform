import type { DesktopStreamEvent } from "@ngriffin_uk/polychat-schemas";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function parseAgentProcessOutput(runId: string, line: string): DesktopStreamEvent {
  try {
    const parsed: unknown = JSON.parse(line);
    if (isRecord(parsed)) {
      const item = isRecord(parsed.item) ? parsed.item : undefined;
      const delta =
        stringValue(parsed.delta) ??
        stringValue(parsed.text) ??
        stringValue(parsed.content) ??
        stringValue(item?.text);
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
