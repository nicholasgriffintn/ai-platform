import {
  POLY_CONVERSATION_TYPE,
  parseStandingApprovalId,
  standingApprovalId,
  TEAMMATE_STANDING_APPROVAL_DAYS,
  listPageOf,
  type ListPage,
  type StandingApproval,
  type TeammateStandingApproval,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { isStandingApprovalEligible } from "~/modules/chat/application/tools/effects";
import { readPendingPolyCall } from "~/modules/poly/application/pending-call";
import { requirePolyContext } from "~/modules/poly/application/poly-context";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";

const DAY_MS = 24 * 60 * 60 * 1000;

function isLive(approval: TeammateStandingApproval, now: number): boolean {
  return Date.parse(approval.expiresAt) > now;
}

function presentStandingApproval(approval: TeammateStandingApproval): StandingApproval {
  return {
    object: "standing_approval",
    id: standingApprovalId(approval.toolName, approval.destination),
    tool_name: approval.toolName,
    destination: approval.destination,
    granted_at: approval.grantedAt,
    expires_at: approval.expiresAt,
  };
}

export async function grantPolyStandingApproval(
  context: ServiceContext,
  interactionId: string,
): Promise<StandingApproval> {
  const polyContext = await requirePolyContext(context);
  const call = await readPendingPolyCall(context, polyContext, interactionId);

  if (!call) {
    throw new AssistantError(
      "That approval is no longer waiting in Poly's conversation",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const { toolName, destination } = call;
  const eligible = isStandingApprovalEligible({
    autonomyLevel: polyContext.autonomyLevel,
    conversationType: POLY_CONVERSATION_TYPE,
    effectClass: call.effectClass,
    destination,
  });

  if (!eligible || !destination) {
    throw new AssistantError(
      "This action cannot be allowed ahead of time",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const now = Date.now();
  const approvals = [
    ...polyContext.standingApprovals.filter(
      (approval) =>
        isLive(approval, now) &&
        !(approval.toolName === toolName && approval.destination === destination),
    ),
    {
      toolName,
      destination,
      grantedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + TEAMMATE_STANDING_APPROVAL_DAYS * DAY_MS).toISOString(),
    },
  ];
  const updated = await context.repositories
    .get(TeammateContextRepository)
    .updateStandingApprovals(polyContext.id, approvals);
  const granted = approvals.at(-1);

  if (!updated || !granted) {
    throw new AssistantError("Poly is not available", ErrorType.NOT_FOUND, 404);
  }

  return presentStandingApproval(granted);
}

export async function listPolyStandingApprovals(
  context: ServiceContext,
): Promise<ListPage<StandingApproval>> {
  const polyContext = await requirePolyContext(context);
  const now = Date.now();

  return listPageOf(
    polyContext.standingApprovals
      .filter((approval) => isLive(approval, now))
      .map(presentStandingApproval),
    (approval) => approval.id,
  );
}

export async function revokePolyStandingApproval(
  context: ServiceContext,
  standingApprovalId: string,
): Promise<{ deleted: true }> {
  const parsed = parseStandingApprovalId(standingApprovalId);

  if (!parsed) {
    throw new AssistantError("Standing approval not found", ErrorType.NOT_FOUND, 404);
  }

  const { toolName, destination } = parsed;
  const polyContext = await requirePolyContext(context);
  const now = Date.now();
  const updated = await context.repositories.get(TeammateContextRepository).updateStandingApprovals(
    polyContext.id,
    polyContext.standingApprovals.filter(
      (approval) =>
        isLive(approval, now) &&
        !(approval.toolName === toolName && approval.destination === destination),
    ),
  );

  if (!updated) {
    throw new AssistantError("Poly is not available", ErrorType.NOT_FOUND, 404);
  }

  return { deleted: true };
}
