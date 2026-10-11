import {
  decisionReceiptAlternativeSchema,
  type PolyHandoffJudgement,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

const URGENCY_QUESTION = "urgency";
const HANDOFF_OVERRIDE_PREFIX = "poly.handoff_urgency:";

const handoffReceiptSchema = z.object({
  recommendation: z.object({
    outcome: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }),
  alternatives: z.array(decisionReceiptAlternativeSchema).default([]),
});

export function handoffOverrideRef(sourceId: string): string {
  return `${HANDOFF_OVERRIDE_PREFIX}${sourceId}`;
}

export function readHandoffJudgement(receipt: unknown): PolyHandoffJudgement | null {
  const parsed = handoffReceiptSchema.safeParse(receipt);

  if (!parsed.success) {
    return null;
  }

  return {
    chosen: parsed.data.recommendation.outcome,
    confidence: parsed.data.recommendation.confidence,
    alternatives: parsed.data.alternatives
      .filter((alternative) => alternative.question === URGENCY_QUESTION)
      .map(({ option, probability }) => ({ option, probability })),
  };
}
