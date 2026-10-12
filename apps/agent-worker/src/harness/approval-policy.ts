import type { PermissionMode } from "@ngriffin_uk/polychat-schemas";

export type HarnessToolEffect = "read" | "write" | "execute";

export function toolNeedsApproval(effect: HarnessToolEffect, mode: PermissionMode): boolean {
  if (effect === "read" || mode === "full_access" || mode === "auto") {
    return false;
  }

  return mode === "supervised" || effect === "execute";
}
