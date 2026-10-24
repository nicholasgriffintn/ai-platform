import {
  capTeammateAutonomyLevel,
  isOwnerStartedTrigger,
  isPolyTeammateId,
  type ChatRunTrigger,
  type TeammateAutonomyLevel,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { applyOwnerAbsenceBrake } from "~/modules/poly/domain/earned-trust";

import type { ResolvedTeammateInvocation } from "./execution";

export function requirePolyHomeRun(
  resolution: ResolvedTeammateInvocation | undefined,
  conversationId: string,
): void {
  const home = resolution?.context;
  const source = resolution?.invocation.source;
  const inOwnConversation =
    source === "routine" ||
    ((source === "conversation" || source === "channel") &&
      home?.homeConversationId === conversationId);

  if (
    !resolution ||
    !inOwnConversation ||
    !home ||
    !isPolyTeammateId(home.teammateId) ||
    home.scope.type !== "personal" ||
    home.status !== "active"
  ) {
    throw new AssistantError("Poly only works in its own conversation", ErrorType.FORBIDDEN, 403);
  }
}

export function admitTeammateContextAuthority(params: {
  context: TeammateContext;
  trigger: ChatRunTrigger | undefined;
  ceiling?: TeammateAutonomyLevel;
  now: number;
}) {
  const { context } = params;
  const authority = isPolyTeammateId(context.teammateId)
    ? applyOwnerAbsenceBrake({
        autonomyLevel: context.autonomyLevel,
        standingApprovals: context.standingApprovals,
        ownerSeenAt: context.ownerSeenAt,
        ownerStartedRun: isOwnerStartedTrigger(params.trigger),
        now: params.now,
      })
    : {
        autonomyLevel: context.autonomyLevel,
        standingApprovals: context.standingApprovals,
        braked: false,
      };

  const capped = Boolean(params.ceiling);

  return {
    contextId: context.id,
    autonomyLevel: capTeammateAutonomyLevel(authority.autonomyLevel, params.ceiling),
    standingApprovals: capped ? [] : authority.standingApprovals,
    approvalStreaks: context.approvalStreaks,
    actingRulesSuspended: authority.braked || capped,
  };
}
