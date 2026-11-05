import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  TEAMMATE_STANDING_APPROVAL_DAYS,
  type ChatRun,
  type TeammateContext,
  type TeammateStandingApproval,
} from "@ngriffin_uk/polychat-schemas";
import { DAY_MS, isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { recordApprovalOutcome } from "~/modules/poly/domain/earned-trust";
import { readToolInteractionResolution } from "~/modules/responses/application/runs/interactions";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import { isStandingApprovalEligible } from "~/modules/tools/application/effects";

import { readPendingTeammateCall } from "./pending-call";

const OWNER_SEEN_RESOLUTION_MS = 60 * 60 * 1000;

type PendingTeammateCall = NonNullable<Awaited<ReturnType<typeof readPendingTeammateCall>>>;

export async function markTeammateOwnerSeen(
  context: ServiceContext,
  teammateContext: TeammateContext,
  now = Date.now(),
): Promise<void> {
  await context.repositories
    .get(TeammateContextRepository)
    .markOwnerSeen(
      teammateContext.id,
      new Date(now).toISOString(),
      new Date(now - OWNER_SEEN_RESOLUTION_MS).toISOString(),
    );
}

export function isStandingCallEligible(
  teammateContext: TeammateContext,
  call: PendingTeammateCall,
): boolean {
  return isStandingApprovalEligible({
    autonomyLevel: teammateContext.autonomyLevel,
    teammateContextId: teammateContext.id,
    effectClass: call.effectClass,
    destination: call.destination,
  });
}

export async function keepStandingApproval(params: {
  context: ServiceContext;
  teammateContext: TeammateContext;
  toolName: string;
  destination: string;
  now: number;
}): Promise<TeammateStandingApproval | null> {
  const { teammateContext, toolName, destination, now } = params;
  const granted: TeammateStandingApproval = {
    toolName,
    destination,
    grantedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TEAMMATE_STANDING_APPROVAL_DAYS * DAY_MS).toISOString(),
  };
  const updated = await params.context.repositories
    .get(TeammateContextRepository)
    .updateStandingApprovals(teammateContext.id, [
      ...teammateContext.standingApprovals.filter(
        (approval) =>
          Date.parse(approval.expiresAt) > now &&
          !(approval.toolName === toolName && approval.destination === destination),
      ),
      granted,
    ]);

  return updated ? granted : null;
}

function asksToStandApproved(options: unknown): boolean {
  const interaction = isRecord(options) ? options.toolInteraction : undefined;
  const response = isRecord(interaction) ? interaction.response : undefined;

  return isRecord(response) && response.standing === true;
}

export async function recordTeammateApprovalOutcome(params: {
  context: ServiceContext;
  run: ChatRun | null;
  interactionId: string;
  options: unknown;
  now?: number;
}): Promise<void> {
  const user = params.context.user;
  const outcome = readToolInteractionResolution(params.options);

  if (!user || !outcome || !params.run?.teammateContextId) {
    return;
  }

  const teammateContext = await params.context.repositories
    .get(TeammateContextRepository)
    .getById(params.run.teammateContextId);

  if (!teammateContext || !ownsResource(user.id, teammateContext.actorUserId)) {
    return;
  }

  const now = params.now ?? Date.now();
  const call = await readPendingTeammateCall(
    params.context,
    params.run.conversationId,
    params.interactionId,
  );

  await markTeammateOwnerSeen(params.context, teammateContext, now);

  if (!call?.destination || !isStandingCallEligible(teammateContext, call)) {
    return;
  }

  await params.context.repositories.get(TeammateContextRepository).updateApprovalStreaks(
    teammateContext.id,
    recordApprovalOutcome({
      streaks: teammateContext.approvalStreaks,
      toolName: call.toolName,
      destination: call.destination,
      interactionId: params.interactionId,
      outcome,
      now,
    }),
  );

  if (outcome === "approved" && asksToStandApproved(params.options)) {
    await keepStandingApproval({
      context: params.context,
      teammateContext,
      toolName: call.toolName,
      destination: call.destination,
      now,
    });
  }
}
