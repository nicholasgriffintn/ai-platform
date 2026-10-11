import type { Correction, CorrectionPlacement } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import {
  findRecurringCorrection,
  recordCorrectionRecurrence,
  recordNewCorrection,
  requireCorrectionQuote,
} from "./corrections";

export interface CorrectionPlacementResult {
  placementRef: string | null;
  note: string;
}

export type ProposeCorrectionOutcome<TFailure> =
  | { kind: "already_recorded"; correction: Correction }
  | { kind: "placement_failed"; failure: TFailure }
  | {
      kind: "recorded";
      correctionId: string;
      recurred: boolean;
      placement: CorrectionPlacement;
      placed: CorrectionPlacementResult;
    };

export async function proposeCorrection<TFailure>(
  context: ServiceContext,
  input: {
    conversationId: string;
    teammateContextId: string | null;
    pattern: string;
    quote: string;
    placement: CorrectionPlacement;
    place: () => Promise<CorrectionPlacementResult | { failure: TFailure }>;
  },
): Promise<ProposeCorrectionOutcome<TFailure>> {
  await requireCorrectionQuote(context, input.conversationId, input.quote);

  const recurring = await findRecurringCorrection(context, input.pattern, input.conversationId);

  if (recurring && input.placement === "memory") {
    await recordCorrectionRecurrence(context, {
      correction: recurring,
      placement: recurring.placement,
      placementRef: recurring.placementRef,
    });

    return { kind: "already_recorded", correction: recurring };
  }

  const placed = await input.place();

  if ("failure" in placed) {
    return { kind: "placement_failed", failure: placed.failure };
  }

  if (recurring) {
    await recordCorrectionRecurrence(context, {
      correction: recurring,
      placement: input.placement,
      placementRef: placed.placementRef,
    });

    return {
      kind: "recorded",
      correctionId: recurring.id,
      recurred: true,
      placement: input.placement,
      placed,
    };
  }

  const correctionId = await recordNewCorrection(context, {
    teammateContextId: input.teammateContextId,
    conversationId: input.conversationId,
    pattern: input.pattern,
    quote: input.quote,
    placement: input.placement,
    placementRef: placed.placementRef,
  });

  return { kind: "recorded", correctionId, recurred: false, placement: input.placement, placed };
}
