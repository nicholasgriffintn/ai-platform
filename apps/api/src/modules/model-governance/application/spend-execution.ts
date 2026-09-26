import {
  type ResolveSpendRequest,
  resolveSpendRequestSchema,
  type SpendRequest,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  conflict,
  notFound,
  requireModelAction,
} from "~/modules/model-registry/application/access";
import { startApprovedDeployment } from "~/modules/model-serving/application/deployments";
import { startApprovedRun } from "~/modules/model-training/application/runs";

import { toSpendRequest } from "./spend-requests";

export async function resolveSpendRequest(
  context: ServiceContext,
  workspaceId: string,
  requestId: string,
  input: ResolveSpendRequest,
): Promise<SpendRequest> {
  const { userId, separationOfDuties } = await requireModelAction(context, workspaceId, "approve");
  const { state } = resolveSpendRequestSchema.parse(input);
  const repositories = context.repositories;
  const request = await repositories.modelSpend.getSpendRequest(workspaceId, requestId);

  if (!request) {
    throw notFound("Spend request");
  }

  if (request.state !== "pending") {
    throw conflict(`The request is already ${request.state}`);
  }

  if (separationOfDuties && state === "approved" && request.requested_by === userId) {
    throw new AssistantError(
      "Separation of duties: someone other than the requester must approve spend",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const requestedBy = request.requested_by ?? userId;
  const subjectId =
    state === "rejected"
      ? null
      : request.subject_type === "training_run"
        ? (await startApprovedRun(context, workspaceId, requestedBy, request.payload)).id
        : (await startApprovedDeployment(context, workspaceId, requestedBy, request.payload)).id;

  await repositories.modelSpend.resolveSpendRequest({
    id: request.id,
    state,
    decidedBy: userId,
    subjectId,
  });
  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: `model_spend.${state}`,
    targetType: "model_spend_request",
    targetId: request.id,
    metadata: { subjectType: request.subject_type, subjectId, estimateUsd: request.estimate_usd },
  });

  const resolved = await repositories.modelSpend.getSpendRequest(workspaceId, requestId);

  if (!resolved) {
    throw notFound("Spend request");
  }

  return toSpendRequest(resolved);
}
