import type { PolyHandoffDisagreement } from "@ngriffin_uk/polychat-schemas";
import { truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { recordPolicyCorrection } from "~/modules/corrections/application/corrections";
import { handoffOverrideRef } from "~/modules/poly/domain/handoff-overrides";

import { readPolyHandoff } from "./handoffs";
import { requirePolyContext } from "./poly-context";

const TITLE_LIMIT = 120;

export async function disagreeWithPolyHandoff(
  context: ServiceContext,
  handoffId: string,
): Promise<PolyHandoffDisagreement> {
  const user = context.requireUser();
  const polyContext = await requirePolyContext(context);
  const record = await context.repositories.get(ActivityRepository).getActivityById(handoffId);
  const handoff = record ? readPolyHandoff(record) : null;

  if (
    !record ||
    !handoff ||
    record.created_by_user_id !== user.id ||
    record.conversation_id !== polyContext.homeConversationId
  ) {
    throw new AssistantError("That handoff is not in your Poly thread", ErrorType.NOT_FOUND, 404);
  }

  if (handoff.data.decision !== "noted") {
    throw new AssistantError("Poly already told you about that one", ErrorType.CONFLICT_ERROR, 409);
  }

  const title = truncateSingleLine(handoff.title, TITLE_LIMIT);
  const correctionId = await recordPolicyCorrection(context, {
    conversationId: polyContext.homeConversationId,
    pattern: `Tell me when “${title}” has a result`,
    quote: `You disagreed when Poly kept “${title}” quiet`,
    placementRef: handoffOverrideRef(handoff.data.sourceId),
  });

  return {
    correction_id: correctionId,
    result_conversation_id: handoff.data.resultConversationId,
  };
}
