import z from "zod/v4";

import { JSON_ANSWER_INSTRUCTION, parseJsonAnswer } from "../answers.js";
import { LONG_ODDS_QUESTIONS } from "../data/long-odds-questions.js";
import { defineBenchmark } from "../define.js";

export interface LongOddsQuestion {
  id: string;
  question: string;
  answer: boolean;
  note: string;
}

const answerSchema = z.object({
  probability: z.coerce.number().min(0).max(1),
});

type LongOddsAnswer = z.infer<typeof answerSchema>;

export function brierScore(probability: number, outcome: boolean): number {
  return (probability - (outcome ? 1 : 0)) ** 2;
}

const SYSTEM = [
  "You are answering yes or no questions as probabilities, without looking anything up.",
  "Say how likely it is that the true answer is yes. 0.5 means you have no idea; 1 means you are certain it is yes.",
  "Answers are scored with the Brier rule, so confident mistakes cost the most.",
].join(" ");

export const longOdds = defineBenchmark<LongOddsQuestion, LongOddsAnswer>({
  summary: {
    id: "long-odds",
    version: 1,
    name: "Long Odds",
    tagline: "Yes or no, but say how sure",
    description:
      "Surprising yes or no questions answered as probabilities. Hedging costs a little, confident nonsense costs a lot, and decision models are welcome at the table.",
    method:
      "30 settled questions, 16 yes and 14 no. Each answer is scored as 1 minus the Brier score, so a coin-flip 0.5 earns 75 and a confident wrong answer earns nothing. Language models run at medium reasoning effort; decision models answer through their own calibrated head.",
    category: "Calibration",
    scoring: "auto",
    input: "text",
    artefact: null,
    playable: true,
    decisionModels: true,
    itemsPerPlay: 10,
    scoreScale: 100,
    scoreUnit: "/ 100",
    metrics: [
      { key: "brier", label: "Brier score", format: "number", lowerIsBetter: true },
      { key: "accuracy", label: "Right side of 50%", format: "percent" },
    ],
    credit: null,
  },
  items: LONG_ODDS_QUESTIONS.map((question) => ({ id: question.id, truth: question })),
  answerSchema,
  prompt: (item) => ({
    system: SYSTEM,
    user: [
      item.truth.question,
      'Reply as {"probability": <number between 0 and 1 that the answer is yes>}.',
      JSON_ANSWER_INSTRUCTION,
    ].join("\n"),
    imageItemId: null,
  }),
  publicData: (item) => ({ question: item.truth.question }),
  decision: (item) => ({
    state: { question: item.truth.question },
    questions: {
      answer: {
        type: "noul",
        instructions: "Using general knowledge, is the true answer to `question` yes?",
      },
    },
    answerKey: "answer",
  }),
  fromDecision: (probability) => ({ probability }),
  parse: parseJsonAnswer,
  score: (item, answer) => {
    const brier = brierScore(answer.probability, item.truth.answer);

    return {
      score: 1 - brier,
      detail: {
        brier,
        probability: answer.probability,
        correct:
          answer.probability === 0.5 ? false : answer.probability > 0.5 === item.truth.answer,
      },
    };
  },
  reveal: (item) => ({ answer: item.truth.answer, note: item.truth.note }),
  metrics: (results) => {
    const answered = results.filter((result) => result.answer !== null);

    return {
      brier:
        results.length === 0
          ? 0
          : results.reduce((total, result) => total + Number(result.detail.brier ?? 1), 0) /
            results.length,
      accuracy:
        results.length === 0
          ? 0
          : answered.filter((result) => result.detail.correct === true).length / results.length,
    };
  },
});
