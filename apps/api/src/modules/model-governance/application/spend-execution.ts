import { authorise } from "@ngriffin_uk/polychat-library-policy";
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

  const isAuthorised = authorise("model.approve", {
    separationOfDuties,
    actorId: String(userId),
    requestedBy: String(request.requested_by),
  }).allowed;

  if (state === "approved" && !isAuthorised) {
    throw new AssistantError(
      "Separation of duties: someone other than the requester must approve spend",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  let resolved = await repositories.modelSpend.claimSpendRequest({
    id: request.id,
    workspaceId,
    state: state === "approved" ? "executing" : "rejected",
    decidedBy: userId,
  });

  if (!resolved) {
    throw conflict("Someone else has already handled this request");
  }

  if (state === "approved") {
    try {
      const requestedBy = request.requested_by ?? userId;
      const subject =
        request.subject_type === "training_run"
          ? await startApprovedRun(context, workspaceId, requestedBy, request.payload)
          : await startApprovedDeployment(context, workspaceId, requestedBy, request.payload);

      resolved = await repositories.modelSpend.finishSpendRequest({
        id: request.id,
        workspaceId,
        state: "approved",
        subjectId: subject.id,
      });
    } catch (error) {
      await repositories.modelSpend.finishSpendRequest({
        id: request.id,
        workspaceId,
        state: "failed",
        subjectId: null,
      });
      await repositories.audit.createRecord({
        workspaceId,
        actorUserId: userId,
        action: "model_spend.failed",
        targetType: "model_spend_request",
        targetId: request.id,
        metadata: { subjectType: request.subject_type },
      });
      throw error;
    }
  }

  if (!resolved) {
    throw conflict("The spend request changed while it was being executed");
  }

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: `model_spend.${state}`,
    targetType: "model_spend_request",
    targetId: request.id,
    metadata: {
      subjectType: request.subject_type,
      subjectId: resolved.subject_id,
      estimateUsd: request.estimate_usd,
    },
  });

  return toSpendRequest(resolved);
}
