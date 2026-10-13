import {
  isDecisionAnswerOfType,
  normaliseDecisionScore,
  readDecisionNoul,
  roundDecisionScore,
  type DecisionQuestions,
  type DecisionRequest,
  type DecisionResponse,
} from "@ngriffin_uk/polychat-schemas";

export const DRAMA_LEVELS = ["Barely moving", "Polite", "Committed", "Theatrical", "Award-worthy"];
const TALKING_THRESHOLD = 0.6;
const CORRECT_BONUS = 25;

const cardId = (index: number) => `c${index}`;

export function buildCharadesRequest(
  cards: readonly string[],
  video: string,
  deckName: string,
): DecisionRequest {
  const questions: DecisionQuestions = {
    card: {
      type: "choice",
      instructions:
        "The person in the video is acting out one card from this charades deck. Which card are they performing?",
      criteria: Object.fromEntries(cards.map((card, index) => [cardId(index), card])),
    },
    performing: {
      type: "noul",
      instructions: "Is a person visibly acting something out on camera?",
    },
    talking: {
      type: "noul",
      instructions:
        "Does the performer say real words out loud? Sound effects, humming, clapping and animal noises do not count.",
    },
    drama: {
      type: "score",
      instructions: "How much energy and commitment does the performance show?",
      criteria: DRAMA_LEVELS,
    },
  };

  return {
    state: {
      game: "charades",
      deck: deckName,
      rules: "Players act out the card. Sound effects are allowed, but speaking words is cheating.",
    },
    videos: [video],
    questions,
  };
}

export interface CharadesGuess {
  card: string;
  probability: number;
}

export interface CharadesVerdict {
  guesses: CharadesGuess[];
  topGuess: string;
  correct: boolean;
  secretProbability: number;
  secretRank: number;
  performing: number;
  talking: number;
  caughtTalking: boolean;
  drama: { label: string; score: number };
  points: number;
}

export function judgeCharades(
  response: DecisionResponse,
  cards: readonly string[],
  secretIndex: number,
): CharadesVerdict {
  const card = response.answers.card;
  const probabilities = isDecisionAnswerOfType(card, "choice") ? card.probabilities : {};
  const guesses = cards
    .map((text, index) => ({ card: text, probability: probabilities[cardId(index)] ?? 0 }))
    .sort((left, right) => right.probability - left.probability);
  const secret = cards[secretIndex] ?? "";
  const secretProbability = probabilities[cardId(secretIndex)] ?? 0;
  const topGuess = guesses[0]?.card ?? "";
  const correct = topGuess === secret;
  const talking = readDecisionNoul(response.answers, "talking");
  const caughtTalking = talking >= TALKING_THRESHOLD;
  const drama = response.answers.drama;
  const raw = Math.round(secretProbability * 100) + (correct ? CORRECT_BONUS : 0);

  return {
    guesses,
    topGuess,
    correct,
    secretProbability,
    secretRank: guesses.findIndex((guess) => guess.card === secret) + 1,
    performing: readDecisionNoul(response.answers, "performing"),
    talking,
    caughtTalking,
    drama: isDecisionAnswerOfType(drama, "score")
      ? {
          label: DRAMA_LEVELS[roundDecisionScore(drama)] ?? "",
          score: normaliseDecisionScore(drama),
        }
      : { label: "", score: 0 },
    points: caughtTalking ? Math.floor(raw / 2) : raw,
  };
}
