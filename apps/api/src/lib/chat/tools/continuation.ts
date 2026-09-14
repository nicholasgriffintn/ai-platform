const SUCCESSFUL_TOOL_STATUSES = new Set(["success", "completed"]);

export function isSuccessfulToolStatus(status: string | null | undefined): boolean {
  return SUCCESSFUL_TOOL_STATUSES.has(status || "");
}
