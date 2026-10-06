import {
  POLY_TEAMMATE_ID,
  type PolyHome,
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

export async function openPolyHome(context: ServiceContext): Promise<PolyHome> {
  return toPolyHome(await requirePolyContext(context));
}
