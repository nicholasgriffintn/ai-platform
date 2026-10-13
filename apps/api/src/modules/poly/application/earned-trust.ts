import { POLY_CONVERSATION_TYPE, POLY_TEAMMATE_ID } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { readToolInteractionResolution } from "~/modules/chat-runs/application/interactions";
import { isStandingApprovalEligible } from "~/modules/chat/application/tools/effects";
import { recordApprovalOutcome } from "~/modules/poly/domain/earned-trust";

import { markPolyOwnerSeen } from "./home";
import { readPendingPolyCall } from "./standing-approvals";

export async function recordPolyApprovalOutcome(params: {
  context: ServiceContext;
  conversationId: string;
  interactionId: string;
  options: unknown;
  now?: number;
}): Promise<void> {
  const user = params.context.user;
  const outcome = readToolInteractionResolution(params.options);

  if (!user || !outcome) {
    return;
  }

  const polyContext = await params.context.repositories.teammateContexts.getByIdentity({
    teammateId: POLY_TEAMMATE_ID,
    actorUserId: user.id,
    scope: { type: "personal", id: String(user.id) },
  });

  if (!polyContext || polyContext.homeConversationId !== params.conversationId) {
    return;
  }

  const now = params.now ?? Date.now();
  const call = await readPendingPolyCall(params.context, polyContext, params.interactionId);

  await markPolyOwnerSeen(params.context, polyContext, now);

  if (
    !call?.destination ||
    !isStandingApprovalEligible({
      autonomyLevel: polyContext.autonomyLevel,
      conversationType: POLY_CONVERSATION_TYPE,
      effectClass: call.effectClass,
      destination: call.destination,
    })
  ) {
    return;
  }

  await params.context.repositories.teammateContexts.updateApprovalStreaks(
    polyContext.id,
    recordApprovalOutcome({
      streaks: polyContext.approvalStreaks,
      toolName: call.toolName,
      destination: call.destination,
      interactionId: params.interactionId,
      outcome,
      now,
    }),
  );
}
