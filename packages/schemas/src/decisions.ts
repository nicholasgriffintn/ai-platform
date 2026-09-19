import z from "zod/v4";

export type DecisionEntry =
  | string
  | number
  | boolean
  | null
  | DecisionEntry[]
  | { [key: string]: DecisionEntry };

export const decisionEntrySchema: z.ZodType<DecisionEntry> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(decisionEntrySchema),
    z.record(z.string(), decisionEntrySchema),
  ]),
);

export const decisionStateSchema = z.union([
  z.string().min(1),
  z.record(z.string(), decisionEntrySchema),
  z.array(decisionEntrySchema).min(1),
]);
export type DecisionState = z.infer<typeof decisionStateSchema>;

export const DECISION_CHOICE_MAX_OPTIONS = 255;
export const DECISION_SCORE_MIN_LEVELS = 2;
export const DECISION_SCORE_MAX_LEVELS = 10;
export const DECISION_QUESTION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

const decisionQuestionIdSchema = z.string().regex(DECISION_QUESTION_ID_PATTERN);

export const decisionChoiceQuestionSchema = z
  .object({
    type: z.literal("choice"),
    instructions: decisionEntrySchema,
    criteria: z
      .record(z.string().min(1), decisionEntrySchema)
      .refine(
        (criteria) =>
          Object.keys(criteria).length >= 2 &&
          Object.keys(criteria).length <= DECISION_CHOICE_MAX_OPTIONS,
        { message: `Choice questions need between 2 and ${DECISION_CHOICE_MAX_OPTIONS} options` },
      ),
  })
  .strict();
export type DecisionChoiceQuestion = z.infer<typeof decisionChoiceQuestionSchema>;

export const decisionScoreQuestionSchema = z
  .object({
    type: z.literal("score"),
    instructions: decisionEntrySchema,
    criteria: z
      .array(decisionEntrySchema)
      .min(DECISION_SCORE_MIN_LEVELS)
      .max(DECISION_SCORE_MAX_LEVELS),
  })
  .strict();
export type DecisionScoreQuestion = z.infer<typeof decisionScoreQuestionSchema>;

export const decisionNoulQuestionSchema = z
  .object({
    type: z.literal("noul"),
    instructions: decisionEntrySchema,
    criteria: z
      .object({ true: decisionEntrySchema, false: decisionEntrySchema })
      .strict()
      .optional(),
  })
  .strict();
export type DecisionNoulQuestion = z.infer<typeof decisionNoulQuestionSchema>;

export const decisionQuestionSchema = z.discriminatedUnion("type", [
  decisionChoiceQuestionSchema,
  decisionScoreQuestionSchema,
  decisionNoulQuestionSchema,
]);
export type DecisionQuestion = z.infer<typeof decisionQuestionSchema>;
export type DecisionQuestionType = DecisionQuestion["type"];

export const decisionQuestionsSchema = z
  .record(decisionQuestionIdSchema, decisionQuestionSchema)
  .refine((questions) => Object.keys(questions).length > 0, {
    message: "At least one question is required",
  });
export type DecisionQuestions = z.infer<typeof decisionQuestionsSchema>;

export const decisionRequestSchema = z
  .object({
    state: decisionStateSchema,
    questions: decisionQuestionsSchema,
    model: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
  })
  .strict();
export type DecisionRequest = z.infer<typeof decisionRequestSchema>;

const probabilitySchema = z.number().min(0).max(1);

export const decisionChoiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: z.record(z.string(), probabilitySchema),
  confidence: probabilitySchema,
});
export type DecisionChoiceAnswer = z.infer<typeof decisionChoiceAnswerSchema>;

export const decisionScoreAnswerSchema = z.object({
  type: z.literal("score"),
  score: z.number().min(0),
  legend: z.record(z.string(), decisionEntrySchema),
  probabilities: z.record(z.string(), probabilitySchema),
  confidence: probabilitySchema,
});
export type DecisionScoreAnswer = z.infer<typeof decisionScoreAnswerSchema>;

export const decisionNoulAnswerSchema = z.object({
  type: z.literal("noul"),
  noul: probabilitySchema,
});
export type DecisionNoulAnswer = z.infer<typeof decisionNoulAnswerSchema>;

export const decisionAnswerSchema = z.discriminatedUnion("type", [
  decisionChoiceAnswerSchema,
  decisionScoreAnswerSchema,
  decisionNoulAnswerSchema,
]);
export type DecisionAnswer = z.infer<typeof decisionAnswerSchema>;

export type DecisionAnswerFor<TQuestion extends DecisionQuestion> = TQuestion extends {
  type: "choice";
}
  ? DecisionChoiceAnswer
  : TQuestion extends { type: "score" }
    ? DecisionScoreAnswer
    : DecisionNoulAnswer;

export type DecisionAnswers<TQuestions extends DecisionQuestions> = {
  [TId in keyof TQuestions]: DecisionAnswerFor<TQuestions[TId]>;
};

export const decisionUsageSchema = z.object({
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
});
export type DecisionUsage = z.infer<typeof decisionUsageSchema>;

export const decisionResponseSchema = z.object({
  provider: z.string(),
  model: z.string(),
  answers: z.record(z.string(), decisionAnswerSchema),
  usage: decisionUsageSchema,
});
export type DecisionResponse = z.infer<typeof decisionResponseSchema>;

export const DECISION_CONFIDENCE_THRESHOLDS = {
  escalate: 0.5,
  act: 0.9,
} as const;

export type DecisionConfidenceBand = "low" | "medium" | "high";

export function decisionConfidenceBand(
  confidence: number,
  thresholds: { escalate: number; act: number } = DECISION_CONFIDENCE_THRESHOLDS,
): DecisionConfidenceBand {
  if (confidence < thresholds.escalate) {
    return "low";
  }

  return confidence >= thresholds.act ? "high" : "medium";
}

export function normaliseDecisionScore(answer: Pick<DecisionScoreAnswer, "score" | "legend">) {
  const topLevel = Object.keys(answer.legend).length - 1;

  return topLevel > 0 ? Math.min(1, Math.max(0, answer.score / topLevel)) : 0;
}

export function roundDecisionScore(answer: Pick<DecisionScoreAnswer, "score" | "legend">) {
  const topLevel = Object.keys(answer.legend).length - 1;

  return Math.min(topLevel, Math.max(0, Math.round(answer.score)));
}

export function decisionNoulIsTrue(answer: Pick<DecisionNoulAnswer, "noul">, threshold = 0.5) {
  return answer.noul >= threshold;
}

export function decisionNoulConfidence(answer: Pick<DecisionNoulAnswer, "noul">) {
  return Math.abs(answer.noul - 0.5) * 2;
}

export function decisionChoiceSelection(
  answer: Pick<DecisionChoiceAnswer, "choice" | "probabilities">,
) {
  const entries = Object.entries(answer.probabilities);

  if (entries.length === 0) {
    return answer.choice;
  }

  const highestProbability = Math.max(...entries.map(([, probability]) => probability));
  const chosenProbability = answer.probabilities[answer.choice];

  if (chosenProbability !== undefined && chosenProbability >= highestProbability) {
    return answer.choice;
  }

  return (
    entries.find(([, probability]) => probability === highestProbability)?.[0] ?? answer.choice
  );
}

export function formatDecisionEntry(value: DecisionEntry): string {
  if (value === null) {
    return "None";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(formatDecisionEntry).join(", ");
  }

  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${formatDecisionEntry(entry)}`)
    .join(", ");
}
