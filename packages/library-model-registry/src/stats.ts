import type { ScoreSummary } from "@ngriffin_uk/polychat-schemas";

const Z_95 = 1.96;

export function summariseScores(values: readonly number[]): ScoreSummary {
  const n = values.length;

  if (n === 0) {
    return { mean: 0, low: 0, high: 0, n: 0 };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / n;

  if (values.every((value) => value === 0 || value === 1)) {
    return wilsonInterval(mean, n);
  }

  const variance =
    n > 1 ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1) : 0;
  const margin = Z_95 * Math.sqrt(variance / n);

  return { mean, low: Math.max(0, mean - margin), high: Math.min(1, mean + margin), n };
}

function wilsonInterval(proportion: number, n: number): ScoreSummary {
  const denominator = 1 + Z_95 ** 2 / n;
  const centre = (proportion + Z_95 ** 2 / (2 * n)) / denominator;
  const margin =
    (Z_95 * Math.sqrt((proportion * (1 - proportion)) / n + Z_95 ** 2 / (4 * n * n))) / denominator;

  return {
    mean: proportion,
    low: Math.max(0, centre - margin),
    high: Math.min(1, centre + margin),
    n,
  };
}

export function isMeaningfullyLower(candidate: ScoreSummary, baseline: ScoreSummary): boolean {
  return candidate.n > 0 && baseline.n > 0 && candidate.high < baseline.low;
}
