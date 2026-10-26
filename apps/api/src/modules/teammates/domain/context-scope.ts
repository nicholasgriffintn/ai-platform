import type { TeammateContextScope } from "@ngriffin_uk/polychat-schemas";

export interface RunScope {
  type: "personal" | "project";
  id: string;
  workspaceId: string | null;
}

export function teammateContextCoversRun(scope: TeammateContextScope, run: RunScope): boolean {
  if (scope.type === "workspace") {
    return run.type === "project" && run.workspaceId === scope.id;
  }

  return scope.type === run.type && scope.id === run.id;
}
