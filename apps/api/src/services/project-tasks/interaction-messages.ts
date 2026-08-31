import { safeParseJson } from "~/utils/json";
import { isRecord } from "~/utils/objects";

export function readInteractionMessageData(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    return safeParseJson<Record<string, unknown>>(value);
  }

  return isRecord(value) ? value : null;
}
