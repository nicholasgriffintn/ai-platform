import z from "zod/v4";

import { JSON_ANSWER_INSTRUCTION, parseJsonAnswer } from "../answers.js";
import { countdownPoints, evaluateCountdownExpression } from "../countdown/expression.js";
import { COUNTDOWN_ROUNDS } from "../data/countdown-rounds.js";
import { defineBenchmark } from "../define.js";
import type { ItemScore } from "../types.js";

export interface CountdownRound {
  id: string;
  numbers: number[];
  target: number;
  best: number;
  solution: string;
}

const answerSchema = z.object({
  expression: z.string().trim().min(1).max(200),
});

type CountdownAnswer = z.infer<typeof answerSchema>;

const SYSTEM = [
  "You are a contestant on the Countdown numbers round.",
  "Combine the six numbers with +, -, * and / to reach the target. Use each number at most once; you need not use them all.",
  "Every intermediate result must be a positive whole number. If the target is out of reach, get as close as you can.",
].join(" ");

export const countdown = defineBenchmark<CountdownRound, CountdownAnswer>({
  summary: {
    id: "countdown",
    version: 1,
    name: "Countdown",
    tagline: "Six numbers, one target, no calculator",
    description:
      "The numbers round. Exact answers score 10, within five scores 7 and within ten scores 5, exactly as the show's rules have it.",
    method:
      "50 seeded rounds, each checked by an exhaustive solver: 43 can be solved exactly and 7 have a nearest-possible answer. Working is parsed by a strict arithmetic grammar and never evaluated as code. Medium reasoning effort, no tools.",
    category: "Reasoning",
    scoring: "auto",
    input: "text",
    artefact: null,
    playable: true,
    decisionModels: false,
    itemsPerPlay: 5,
    scoreScale: 10,
    scoreUnit: "/ 10",
    metrics: [
      { key: "exactRate", label: "Exact", format: "percent" },
      { key: "invalidRate", label: "Broke the rules", format: "percent", lowerIsBetter: true },
    ],
    credit: null,
  },
  items: COUNTDOWN_ROUNDS.map((round) => ({ id: round.id, truth: round })),
  answerSchema,
  prompt: (item) => ({
    system: SYSTEM,
    user: [
      `Numbers: ${item.truth.numbers.join(", ")}`,
      `Target: ${item.truth.target}`,
      'Reply as {"expression": "<one arithmetic expression using only these numbers, for example (75 + 25) * 3 - 7>"}.',
      JSON_ANSWER_INSTRUCTION,
    ].join("\n"),
    imageItemId: null,
  }),
  publicData: (item) => ({ numbers: item.truth.numbers, target: item.truth.target }),
  parse: parseJsonAnswer,
  score: (item, answer): ItemScore => {
    const evaluation = evaluateCountdownExpression(answer.expression, item.truth.numbers);

    if (!evaluation.ok) {
      return { score: 0, detail: { valid: false, reason: evaluation.reason } };
    }

    const points = countdownPoints(item.truth.target, evaluation.value);

    return {
      score: points / 10,
      detail: { valid: true, value: evaluation.value, points },
    };
  },
  reveal: (item) => ({
    target: item.truth.target,
    best: item.truth.best,
    solution: item.truth.solution,
  }),
  metrics: (results) => ({
    exactRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.detail.points === 10).length / results.length,
    invalidRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.detail.valid !== true).length / results.length,
  }),
});
