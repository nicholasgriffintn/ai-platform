import type {
  DecisionChoiceAnswer,
  VerbatimRepair,
  VerbatimWord,
} from "@ngriffin_uk/polychat-schemas";

export const SUSPECT_WORD_THRESHOLD = 0.35;
export const REPAIR_ACCEPT_PROBABILITY = 0.6;
export const KEEP_CANDIDATE_ID = "as_heard";

const MAX_SUSPECTS = 4;

export interface RepairPlan {
  candidates: Record<string, string>;
  removals: Record<string, number[]>;
}

export function planRepair(
  words: readonly string[],
  probabilities: readonly (number | null)[],
): RepairPlan | null {
  const suspects = probabilities
    .flatMap((probability, index) =>
      probability !== null && probability < SUSPECT_WORD_THRESHOLD ? [{ index, probability }] : [],
    )
    .sort((left, right) => left.probability - right.probability)
    .slice(0, MAX_SUSPECTS)
    .map(({ index }) => index);

  if (suspects.length === 0) {
    return null;
  }

  const options: [string, number[]][] = suspects.map((index) => [`drop_${index}`, [index]]);

  if (suspects.length > 1) {
    options.push(["drop_all", suspects]);
  }

  const candidates: Record<string, string> = { [KEEP_CANDIDATE_ID]: words.join(" ") };
  const removals: Record<string, number[]> = { [KEEP_CANDIDATE_ID]: [] };
  const seen = new Set([candidates[KEEP_CANDIDATE_ID]]);

  for (const [id, removed] of options) {
    const text = words.filter((_, index) => !removed.includes(index)).join(" ");

    if (text && !seen.has(text)) {
      seen.add(text);
      candidates[id] = text;
      removals[id] = removed;
    }
  }

  return Object.keys(candidates).length > 1 ? { candidates, removals } : null;
}

export function applyRepair(
  words: readonly string[],
  probabilities: readonly (number | null)[],
  plan: RepairPlan,
  answer: Pick<DecisionChoiceAnswer, "choice" | "probabilities">,
): { words: VerbatimWord[]; repair: VerbatimRepair } {
  const keptProbability = answer.probabilities[KEEP_CANDIDATE_ID] ?? 0;
  const probability = answer.probabilities[answer.choice] ?? 0;
  const applied =
    answer.choice !== KEEP_CANDIDATE_ID &&
    probability >= REPAIR_ACCEPT_PROBABILITY &&
    probability > keptProbability;
  const removed = new Set(applied ? (plan.removals[answer.choice] ?? []) : []);

  return {
    words: words.map((text, index) => ({
      text,
      probability: probabilities[index] ?? null,
      removed: removed.has(index),
    })),
    repair: {
      applied,
      candidate: plan.candidates[answer.choice] ?? "",
      probability,
      keptProbability,
    },
  };
}
