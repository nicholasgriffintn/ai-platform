import {
  POLY_CONVERSATION_TYPE,
  TEAMMATE_STANDING_APPROVAL_DAYS,
  type PolyHome,
  type TeammateContext,
  type TeammateStandingApproval,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  isStandingApprovalEligible,
  resolveToolCallDestination,
  resolveToolCallEffectClass,
} from "~/modules/chat/application/tools/effects";
import { resolveFunctionTool } from "~/modules/functions/application";

import { requirePolyContext, toPolyHome } from "./home";

const DAY_MS = 24 * 60 * 60 * 1000;

function isLive(approval: TeammateStandingApproval, now: number): boolean {
  return Date.parse(approval.expiresAt) > now;
}

export async function readPendingPolyCall(
  context: ServiceContext,
  polyContext: TeammateContext,
  interactionId: string,
) {
  const pending = await context.repositories.messages.getLatestPendingToolMessage(
    polyContext.homeConversationId,
  );

  if (!pending || pending.tool_call_id !== interactionId || typeof pending.name !== "string") {
    return null;
  }

  const toolName = pending.name;
  const effects = resolveFunctionTool(toolName).effects;
  const rawArguments = pending.tool_call_arguments;

  return {
    toolName,
    destination: resolveToolCallDestination({ effects, rawArguments }),
    effectClass: resolveToolCallEffectClass({ toolName, effects, rawArguments }),
  };
}

export async function grantPolyStandingApproval(
  context: ServiceContext,
  interactionId: string,
): Promise<PolyHome> {
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
  const updated = await context.repositories.teammateContexts.updateStandingApprovals(
    polyContext.id,
    approvals,
  );

  if (!updated) {
    throw new AssistantError("Poly is not available", ErrorType.NOT_FOUND, 404);
  }

  return toPolyHome(updated, now);
}

export async function revokePolyStandingApproval(
  context: ServiceContext,
  revoke: { toolName: string; destination: string },
): Promise<PolyHome> {
  const polyContext = await requirePolyContext(context);
  const now = Date.now();
  const updated = await context.repositories.teammateContexts.updateStandingApprovals(
    polyContext.id,
    polyContext.standingApprovals.filter(
      (approval) =>
        isLive(approval, now) &&
        !(approval.toolName === revoke.toolName && approval.destination === revoke.destination),
    ),
  );

  if (!updated) {
    throw new AssistantError("Poly is not available", ErrorType.NOT_FOUND, 404);
  }

  return toPolyHome(updated, now);
}
