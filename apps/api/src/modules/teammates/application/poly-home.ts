import {
  isPolyTeammateId,
  type ChatRunTrigger,
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
  now: number;
}) {
  const { context } = params;
  const authority = isPolyTeammateId(context.teammateId)
    ? applyOwnerAbsenceBrake({
        autonomyLevel: context.autonomyLevel,
        standingApprovals: context.standingApprovals,
        ownerSeenAt: context.ownerSeenAt,
        ownerStartedRun: params.trigger === undefined || params.trigger === "user",
        now: params.now,
      })
    : { autonomyLevel: context.autonomyLevel, standingApprovals: context.standingApprovals };

  return {
    teammate_context_id: context.id,
    autonomy_level: authority.autonomyLevel,
    standing_approvals: authority.standingApprovals,
    approval_streaks: context.approvalStreaks,
  };
}
