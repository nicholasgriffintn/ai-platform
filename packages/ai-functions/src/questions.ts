import type {
  DecisionChoiceQuestion,
  DecisionEntry,
  DecisionNoulQuestion,
  DecisionScoreQuestion,
} from "@ngriffin_uk/polychat-schemas";

export function choice<const TOption extends string>(
  instructions: DecisionEntry,
  criteria: Record<TOption, DecisionEntry> | readonly TOption[],
): DecisionChoiceQuestion & { criteria: Record<TOption, DecisionEntry> } {
  const options = Array.isArray(criteria)
    ? (Object.fromEntries(
        (criteria as readonly TOption[]).map((option) => [option, null]),
      ) as Record<TOption, DecisionEntry>)
    : (criteria as Record<TOption, DecisionEntry>);

  return { type: "choice", instructions, criteria: options };
}

export function score(
  instructions: DecisionEntry,
  levels: readonly DecisionEntry[],
): DecisionScoreQuestion {
  return { type: "score", instructions, criteria: [...levels] };
}

export function noul(
  instructions: DecisionEntry,
  criteria?: { true: DecisionEntry; false: DecisionEntry },
): DecisionNoulQuestion {
  return criteria ? { type: "noul", instructions, criteria } : { type: "noul", instructions };
}
