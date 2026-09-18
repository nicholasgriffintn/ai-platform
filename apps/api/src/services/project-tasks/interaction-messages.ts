import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

export function readInteractionMessageData(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    return safeParseJson<Record<string, unknown>>(value);
  }

  return isRecord(value) ? value : null;
}
