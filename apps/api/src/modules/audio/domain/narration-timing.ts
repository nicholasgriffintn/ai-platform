export interface NarrationTiming {
  start: number;
  end: number;
}

export function timePassages(durations: readonly number[]): NarrationTiming[] {
  let start = 0;

  return durations.map((duration) => {
    const timing = { start, end: start + duration };

    start = timing.end;

    return timing;
  });
}

export function proportionalDurations(weights: readonly number[], totalSeconds: number): number[] {
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);

  return weights.map((weight) => (totalWeight > 0 ? (weight / totalWeight) * totalSeconds : 0));
}
