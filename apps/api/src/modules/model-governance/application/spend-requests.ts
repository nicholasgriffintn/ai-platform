import { SPEND_REQUEST_STATES, type SpendRequest } from "@ngriffin_uk/polychat-schemas";
import { readNonEmptyString, readRecord } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { requireModelAction } from "~/modules/model-registry/application/access";

import type { ModelSpendRequestRecord } from "../infrastructure/ModelSpendRepository";

function summarise(record: ModelSpendRequestRecord): string {
  const payload = record.payload;
  const name =
    record.subject_type === "deployment"
      ? (readNonEmptyString(payload.name) ?? "deployment")
      : (readNonEmptyString(readRecord(payload.spec).outputName) ?? "training run");

  if (record.subject_type === "deployment") {
    const action =
      payload.action === "resume" ? "Resume" : payload.action === "scale" ? "Scale" : "Deploy";

    return `${action} ${name}`;
  }

  return `Train ${name}`;
}

export function toSpendRequest(record: ModelSpendRequestRecord): SpendRequest {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    subjectType: record.subject_type,
    summary: summarise(record),
    estimateUsd: record.estimate_usd,
    reason: record.reason,
    state: record.state,
    subjectId: record.subject_id,
    requestedBy: record.requested_by,
    decidedBy: record.decided_by,
    decidedAt: record.decided_at,
    createdAt: record.created_at,
  };
}

export async function recordSpendRequest(
  repositories: RepositoryManager,
  input: {
    workspaceId: string;
    projectId: string | null;
    subjectType: "training_run" | "deployment";
    payload: Record<string, unknown>;
    estimateUsd: number | null;
    reason: string | null;
    requestedBy: number;
  },
): Promise<SpendRequest> {
  const record = await repositories.modelSpend.createSpendRequest(input);

  await repositories.audit.createRecord({
    workspaceId: input.workspaceId,
    actorUserId: input.requestedBy,
    action: "model_spend.requested",
    targetType: "model_spend_request",
    targetId: record.id,
    metadata: {
      subjectType: input.subjectType,
      estimateUsd: input.estimateUsd,
      reason: input.reason,
    },
  });

  return toSpendRequest(record);
}

export async function listSpendRequests(
  context: ServiceContext,
  workspaceId: string,
): Promise<{ requests: SpendRequest[] }> {
  await requireModelAction(context, workspaceId, "view");

  return {
    requests: (
      await context.repositories.modelSpend.listSpendRequests(workspaceId, [
        ...SPEND_REQUEST_STATES,
      ])
    ).map(toSpendRequest),
  };
}
