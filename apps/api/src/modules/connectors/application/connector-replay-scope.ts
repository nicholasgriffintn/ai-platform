import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";

export function encodeConnectorReplayScope(scope: {
  provider: string;
  runId: string;
  completionId: string;
  connectedAccountId?: string | null;
  recipeId?: string | null;
  installationId?: string | null;
  projectId?: string | null;
  teammateContextId?: string | null;
}): string {
  return canonicalJson({
    provider: scope.provider,
    runId: scope.runId,
    completionId: scope.completionId,
    connectedAccountId: scope.connectedAccountId ?? "",
    recipeId: scope.recipeId ?? "",
    installationId: scope.installationId ?? "",
    projectId: scope.projectId ?? "",
    teammateContextId: scope.teammateContextId ?? "",
  });
}
