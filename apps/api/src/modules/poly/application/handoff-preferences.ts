import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { recordPolicyCorrection } from "~/modules/corrections/application/corrections";
import { CorrectionRepository } from "~/modules/corrections/infrastructure/CorrectionRepository";
import { handoffOverrideRef } from "~/modules/poly/domain/handoff-overrides";

import { requirePolyContext } from "./poly-context";

export async function isRoutineAlwaysNotified(
  context: ServiceContext,
  installationId: string,
): Promise<boolean> {
  const active = await context.repositories
    .get(CorrectionRepository)
    .listActiveByPlacementRefs(context.requireUser().id, [handoffOverrideRef(installationId)]);

  return active.length > 0;
}

export async function setRoutineAlwaysNotified(
  context: ServiceContext,
  input: { installationId: string; title: string; enabled: boolean },
): Promise<void> {
  const user = context.requireUser();
  const corrections = context.repositories.get(CorrectionRepository);
  const placementRef = handoffOverrideRef(input.installationId);

  if (input.enabled) {
    const polyContext = await requirePolyContext(context);

    await recordPolicyCorrection(context, {
      conversationId: polyContext.homeConversationId,
      pattern: `Tell me when “${input.title}” has a result`,
      quote: `You asked to hear when “${input.title}” is ready`,
      placementRef,
    });

    return;
  }

  const active = await corrections.listActiveByPlacementRefs(user.id, [placementRef]);

  await Promise.all(active.map((correction) => corrections.dismiss(user.id, correction.id)));
}
