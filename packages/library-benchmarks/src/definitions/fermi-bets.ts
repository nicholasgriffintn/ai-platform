import { percentile } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { JSON_ANSWER_INSTRUCTION, parseJsonAnswer } from "../answers.js";
import { FERMI_QUESTIONS } from "../data/fermi-questions.js";
import { defineBenchmark } from "../define.js";

export interface FermiQuestion {
  id: string;
  question: string;
  unit: string;
  answer: number;
  source: string;
}

const INTERVAL_ALPHA = 0.1;
const INTERVAL_SHARPNESS = 2;

const answerSchema = z
  .object({
    estimate: z.coerce.number().positive(),
    low: z.coerce.number().positive(),
    high: z.coerce.number().positive(),
  })
  .refine((answer) => answer.low <= answer.estimate && answer.estimate <= answer.high, {
    message: "The estimate must sit inside the interval",
  });

type FermiAnswer = z.infer<typeof answerSchema>;

export function fermiIntervalScore(answer: FermiAnswer, truth: number): number {
  const low = Math.log10(answer.low);
  const high = Math.log10(answer.high);
  const actual = Math.log10(truth);
  const miss = actual < low ? low - actual : actual > high ? actual - high : 0;
  const intervalScore = high - low + (2 / INTERVAL_ALPHA) * miss;

  return Math.exp(-intervalScore / INTERVAL_SHARPNESS);
}

const SYSTEM = [
  "You are answering estimation questions without looking anything up.",
  "Give a point estimate and a 90% confidence interval: the true value should fall inside your interval nine times out of ten.",
  "Narrow intervals score more when they are right, and missing the interval is punished hard.",
].join(" ");

export const fermiBets = defineBenchmark<FermiQuestion, FermiAnswer>({
  summary: {
    id: "fermi-bets",
    version: 1,
    name: "Fermi Bets",
    tagline: "Know roughly, and know how roughly",
    description:
      "Estimation questions with a 90% interval. A tight interval that holds the answer scores well, a wide one scores politely, and a miss hurts.",
    method:
      "40 questions with settled answers. Each answer is scored on the log scale with a 90% interval score: width plus twenty times the miss, mapped to 0–1. A well-calibrated entrant catches about 90% of answers. Medium reasoning effort, no tools.",
    category: "Calibration",
    scoring: "auto",
    input: "text",
    artefact: null,
    playable: true,
    decisionModels: false,
    itemsPerPlay: 8,
    scoreScale: 100,
    scoreUnit: "/ 100",
    metrics: [
      { key: "hitRate", label: "Inside the interval", format: "percent" },
      { key: "medianLogError", label: "Typical miss", format: "decades", lowerIsBetter: true },
    ],
    credit: null,
  },
  items: FERMI_QUESTIONS.map((question) => ({ id: question.id, truth: question })),
  answerSchema,
  prompt: (item) => ({
    system: SYSTEM,
    user: [
      `${item.truth.question} Answer in ${item.truth.unit}.`,
      'Reply as {"estimate": <number>, "low": <number>, "high": <number>} with low ≤ estimate ≤ high.',
      JSON_ANSWER_INSTRUCTION,
    ].join("\n"),
    imageItemId: null,
  }),
  publicData: (item) => ({ question: item.truth.question, unit: item.truth.unit }),
  parse: parseJsonAnswer,
  score: (item, answer) => {
    const hit = answer.low <= item.truth.answer && item.truth.answer <= answer.high;

    return {
      score: fermiIntervalScore(answer, item.truth.answer),
      detail: {
        hit,
        logError: Math.abs(Math.log10(answer.estimate / item.truth.answer)),
        estimate: answer.estimate,
        low: answer.low,
        high: answer.high,
      },
    };
  },
  reveal: (item) => ({
    answer: item.truth.answer,
    unit: item.truth.unit,
    source: item.truth.source,
  }),
  metrics: (results) => {
    const answered = results.filter((result) => result.answer !== null);

    return {
      hitRate:
        results.length === 0
          ? 0
          : answered.filter((result) => result.detail.hit === true).length / results.length,
      medianLogError:
        percentile(
          answered.map((result) => Number(result.detail.logError ?? 0)),
          0.5,
        ) ?? 0,
    };
  },
});
