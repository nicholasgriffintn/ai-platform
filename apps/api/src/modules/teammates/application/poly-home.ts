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

  if (
    !resolution ||
    (resolution.invocation.source !== "conversation" &&
      resolution.invocation.source !== "channel") ||
    !home ||
    !isPolyTeammateId(home.teammateId) ||
    home.scope.type !== "personal" ||
    home.status !== "active" ||
    home.homeConversationId !== conversationId
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
  const loosened = authority.braked || capped;

  return {
    contextId: context.id,
    autonomyLevel: capTeammateAutonomyLevel(authority.autonomyLevel, params.ceiling),
    standingApprovals: capped ? [] : authority.standingApprovals,
    approvalStreaks: context.approvalStreaks,
    toolRules: loosened
      ? context.toolRules.filter((rule) => rule.level !== "act" && rule.level !== "act_if_asked")
      : context.toolRules,
  };
}
