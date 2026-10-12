import {
  decisionConfidenceBand,
  isDecisionAnswerOfType,
  readDecisionNoul,
  roundDecisionScore,
  type DecisionQuestions,
  type DecisionRequest,
  type DecisionResponse,
} from "@ngriffin_uk/polychat-schemas";

import { FLAGS, KEEPER_LEVELS, type Pile, type PhotoFlag } from "./piles.js";

export const NO_PILE = "none";
const FLAG_THRESHOLD = 0.6;

export interface SortResult {
  pileId: string | null;
  bestGuess: string;
  confidence: number;
  probabilities: Record<string, number>;
  flags: PhotoFlag[];
  keeper: string;
}

export function buildSortRequest(image: string, piles: readonly Pile[]): DecisionRequest {
  const criteria: Record<string, string> = Object.fromEntries(
    piles.map((pile) => [
      pile.id,
      pile.description ? `${pile.label}: ${pile.description}` : pile.label,
    ]),
  );
  const questions: DecisionQuestions = {
    pile: {
      type: "choice",
      instructions: "Which pile does this image belong in?",
      criteria: { ...criteria, [NO_PILE]: "None of these piles fits" },
    },
    keeper: {
      type: "score",
      instructions: "How worth keeping is this image as a picture?",
      criteria: KEEPER_LEVELS,
    },
  };

  for (const [flag, instructions] of Object.entries(FLAGS)) {
    questions[flag] = { type: "noul", instructions: `${instructions}?` };
  }

  return { state: "Sort an image into one of the user's piles.", images: [image], questions };
}

function isPhotoFlag(value: string): value is PhotoFlag {
  return value in FLAGS;
}

export function readSortResult(response: DecisionResponse): SortResult {
  const pile = response.answers.pile;
  const keeper = response.answers.keeper;
  const choice = isDecisionAnswerOfType(pile, "choice") ? pile : null;
  const confidence = choice?.confidence ?? 0;
  const bestGuess = choice?.choice ?? NO_PILE;

  return {
    pileId:
      bestGuess !== NO_PILE && decisionConfidenceBand(confidence) !== "low" ? bestGuess : null,
    bestGuess,
    confidence,
    probabilities: choice?.probabilities ?? {},
    flags: Object.keys(FLAGS)
      .filter(isPhotoFlag)
      .filter((flag) => readDecisionNoul(response.answers, flag) >= FLAG_THRESHOLD),
    keeper: isDecisionAnswerOfType(keeper, "score")
      ? (KEEPER_LEVELS[roundDecisionScore(keeper)] ?? "")
      : "",
  };
}
