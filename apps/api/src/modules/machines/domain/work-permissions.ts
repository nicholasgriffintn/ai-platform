import type { PermissionMode, TeammateAutonomyLevel } from "@ngriffin_uk/polychat-schemas";

export function workPermissionMode(
  autonomy: TeammateAutonomyLevel | null | undefined,
): PermissionMode {
  return autonomy === "partner" ? "auto_accept_edits" : "supervised";
}
