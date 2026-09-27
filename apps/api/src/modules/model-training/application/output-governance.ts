import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { isRevoked, loadRegistryScope } from "~/modules/model-registry/application/scope";

import type { ModelTrainingRunRecord } from "../infrastructure/ModelTrainingRepository";

export async function preserveTrainingInputWithdrawals(
  repositories: RepositoryManager,
  run: ModelTrainingRunRecord,
  outputVersionId: string,
): Promise<void> {
  const versionIds = [
    ...new Set([run.spec.baseVersionId, ...run.spec.mergeVersionIds, ...run.dataset_version_ids]),
  ];
  const scope = await loadRegistryScope(repositories, run.workspace_id, run.project_id, {
    versionIds,
  });
  const withdrawn = versionIds.filter(
    (id) =>
      isRevoked(scope, id) ||
      scope.evidence.some(
        (item) => item.versionId === id && item.kind === "erasure" && item.status === "fail",
      ),
  );

  if (withdrawn.length === 0) {
    return;
  }

  const evidence = await repositories.modelGovernance.addEvidence([
    {
      versionId: outputVersionId,
      kind: "provenance",
      source: "provider",
      status: "fail",
      summary: "A training input was withdrawn while this job was running",
      details: { inputVersionIds: withdrawn, runId: run.id },
    },
  ]);

  await repositories.modelGovernance.createDecision({
    workspaceId: run.workspace_id,
    projectId: null,
    versionId: outputVersionId,
    routeId: null,
    state: "revoked",
    verdict: { effect: "block", matches: [], policyHashes: [] },
    evidenceIds: evidence.map((item) => item.id),
    isException: false,
    note: "Training inputs were withdrawn; review the output before reuse",
    requestedBy: null,
  });
}
