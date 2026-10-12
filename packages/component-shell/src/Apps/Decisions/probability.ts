const VERBAL_SCALE: [number, string][] = [
  [0.95, "Almost certainly"],
  [0.8, "Very likely"],
  [0.62, "Probably"],
  [0.38, "Hard to say"],
  [0.2, "Probably not"],
  [0.05, "Very unlikely"],
  [0, "Almost certainly not"],
];

export function describeProbability(probability: number): string {
  return VERBAL_SCALE.find(([floor]) => probability >= floor)?.[1] ?? "Almost certainly not";
}

export type ProbabilityTone = "strong" | "middling" | "weak";

export function probabilityTone(probability: number): ProbabilityTone {
  if (probability >= 0.75) {
    return "strong";
  }

  return probability >= 0.4 ? "middling" : "weak";
}

export const PROBABILITY_TEXT_CLASS: Record<ProbabilityTone, string> = {
  strong: "text-success",
  middling: "text-attention",
  weak: "text-failure",
};

export const PROBABILITY_FILL_CLASS: Record<ProbabilityTone, string> = {
  strong: "bg-success",
  middling: "bg-attention",
  weak: "bg-failure",
};
