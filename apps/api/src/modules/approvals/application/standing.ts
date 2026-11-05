import {
  parseStandingApprovalId,
  standingApprovalId,
  listPageOf,
  type ListPage,
  type StandingApproval,
  type TeammateContext,
  type TeammateStandingApproval,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requirePolyContext } from "~/modules/poly/application/poly-context";
import { requireOwnedTeammateContext } from "~/modules/teammates/application/contexts";
import {
  isStandingCallEligible,
  keepStandingApproval,
} from "~/modules/teammates/application/earned-trust";
import { readPendingTeammateCall } from "~/modules/teammates/application/pending-call";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";

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

function requireStandingContext(
  context: ServiceContext,
  contextId: string | undefined,
): Promise<TeammateContext> {
  return contextId ? requireOwnedTeammateContext(context, contextId) : requirePolyContext(context);
}

export async function grantPolyStandingApproval(
  context: ServiceContext,
  interactionId: string,
): Promise<StandingApproval> {
  const polyContext = await requirePolyContext(context);
  const call = await readPendingTeammateCall(
    context,
    polyContext.homeConversationId,
    interactionId,
  );

  if (!call) {
    throw new AssistantError(
      "That approval is no longer waiting in Poly's conversation",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (!isStandingCallEligible(polyContext, call) || !call.destination) {
    throw new AssistantError(
      "This action cannot be allowed ahead of time",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const granted = await keepStandingApproval({
    context,
    teammateContext: polyContext,
    toolName: call.toolName,
    destination: call.destination,
    now: Date.now(),
  });

  if (!granted) {
    throw new AssistantError("Poly is not available", ErrorType.NOT_FOUND, 404);
  }

  return presentStandingApproval(granted);
}

export async function listStandingApprovals(
  context: ServiceContext,
  contextId?: string,
): Promise<ListPage<StandingApproval>> {
  const teammateContext = await requireStandingContext(context, contextId);
  const now = Date.now();

  return listPageOf(
    teammateContext.standingApprovals
      .filter((approval) => isLive(approval, now))
      .map(presentStandingApproval),
    (approval) => approval.id,
  );
}

export async function revokeStandingApproval(
  context: ServiceContext,
  standingApprovalId: string,
  contextId?: string,
): Promise<{ deleted: true }> {
  const parsed = parseStandingApprovalId(standingApprovalId);

  if (!parsed) {
    throw new AssistantError("Standing approval not found", ErrorType.NOT_FOUND, 404);
  }

  const { toolName, destination } = parsed;
  const teammateContext = await requireStandingContext(context, contextId);
  const now = Date.now();
  const updated = await context.repositories.get(TeammateContextRepository).updateStandingApprovals(
    teammateContext.id,
    teammateContext.standingApprovals.filter(
      (approval) =>
        isLive(approval, now) &&
        !(approval.toolName === toolName && approval.destination === destination),
    ),
  );

  if (!updated) {
    throw new AssistantError("Teammate is not available", ErrorType.NOT_FOUND, 404);
  }

  return { deleted: true };
}
