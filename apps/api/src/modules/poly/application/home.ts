import { POLY_TEAMMATE_ID, type PolyHome } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ensureActiveTeammateContext } from "~/modules/teammates/application/contexts";

export async function openPolyHome(context: ServiceContext): Promise<PolyHome> {
  const user = context.requireUser();
  const polyContext = await ensureActiveTeammateContext(context, POLY_TEAMMATE_ID, {
    type: "personal",
    id: String(user.id),
  });

  return {
    teammate_id: POLY_TEAMMATE_ID,
    context_id: polyContext.id,
    conversation_id: polyContext.homeConversationId,
    autonomy_level: polyContext.autonomyLevel ?? "assistant",
  };
}
