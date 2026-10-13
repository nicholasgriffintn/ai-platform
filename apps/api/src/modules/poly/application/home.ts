import {
  POLY_TEAMMATE_ID,
  type PolyHome,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ensureActiveTeammateContext } from "~/modules/teammates/application/contexts";

const OWNER_SEEN_RESOLUTION_MS = 60 * 60 * 1000;

export function requirePolyContext(context: ServiceContext): Promise<TeammateContext> {
  const user = context.requireUser();

  return ensureActiveTeammateContext(context, POLY_TEAMMATE_ID, {
    type: "personal",
    id: String(user.id),
  });
}

export function toPolyHome(polyContext: TeammateContext, now = Date.now()): PolyHome {
  return {
    teammate_id: POLY_TEAMMATE_ID,
    context_id: polyContext.id,
    conversation_id: polyContext.homeConversationId,
    autonomy_level: polyContext.autonomyLevel ?? "assistant",
    standing_approvals: polyContext.standingApprovals.filter(
      (approval) => Date.parse(approval.expiresAt) > now,
    ),
  };
}

export async function markPolyOwnerSeen(
  context: ServiceContext,
  polyContext: TeammateContext,
  now = Date.now(),
): Promise<void> {
  await context.repositories.teammateContexts.markOwnerSeen(
    polyContext.id,
    new Date(now).toISOString(),
    new Date(now - OWNER_SEEN_RESOLUTION_MS).toISOString(),
  );
}

export async function openPolyHome(context: ServiceContext): Promise<PolyHome> {
  const polyContext = await requirePolyContext(context);

  await markPolyOwnerSeen(context, polyContext);

  return toPolyHome(polyContext);
}
