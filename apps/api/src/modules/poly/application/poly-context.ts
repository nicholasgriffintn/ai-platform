import {
  POLY_TEAMMATE_ID,
  type PolyAgenda,
  type PolyAgendaLists,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ensureActiveTeammateContext } from "~/modules/teammates/application/contexts";

export function requirePolyContext(context: ServiceContext): Promise<TeammateContext> {
  const user = context.requireUser();

  return ensureActiveTeammateContext(context, POLY_TEAMMATE_ID, {
    type: "personal",
    id: String(user.id),
  });
}

export function describePolyContext(
  polyContext: TeammateContext,
  now = Date.now(),
): Omit<PolyAgenda, keyof PolyAgendaLists | "look_around"> {
  return {
    teammate_id: POLY_TEAMMATE_ID,
    context_id: polyContext.id,
    conversation_id: polyContext.homeConversationId,
    autonomy_level: polyContext.autonomyLevel ?? "assistant",
    standing_approvals: polyContext.standingApprovals.filter(
      (approval) => Date.parse(approval.expiresAt) > now,
    ),
    paused_until:
      polyContext.pausedUntil && Date.parse(polyContext.pausedUntil) > now
        ? polyContext.pausedUntil
        : null,
  };
}
