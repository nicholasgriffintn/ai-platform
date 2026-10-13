import { decisionConfidenceBand, type DecisionAnswer } from "@ngriffin_uk/polychat-schemas";

export function formatDecisionAnswer(id: string, answer: DecisionAnswer): string {
  if (answer.type === "noul") {
    return `${id}: ${answer.noul.toFixed(2)} probability of yes`;
  }

  const band = `confidence ${answer.confidence.toFixed(2)}, ${decisionConfidenceBand(answer.confidence)}`;

  if (answer.type === "choice") {
    return `${id}: ${answer.choice} (${band})`;
  }

  const topLevel = Object.keys(answer.legend).length - 1;

  return `${id}: ${answer.score.toFixed(2)} of ${topLevel} (${band})`;
}
