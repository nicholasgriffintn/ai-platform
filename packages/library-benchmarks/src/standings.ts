export interface RankedInterval {
  value: number;
  low: number;
  high: number;
}

export interface Ranked<T> {
  entry: T;
  rank: number;
  tied: boolean;
}

export function rankBySignificance<T>(
  entries: readonly T[],
  interval: (entry: T) => RankedInterval | null,
): Ranked<T>[] {
  const scored = entries
    .map((entry) => ({ entry, interval: interval(entry) }))
    .sort(
      (left, right) =>
        (right.interval?.value ?? Number.NEGATIVE_INFINITY) -
        (left.interval?.value ?? Number.NEGATIVE_INFINITY),
    );
  const ranks = scored.map(({ interval: current }) =>
    current
      ? 1 +
        scored.filter(({ interval: other }) => other !== null && other.low > current.high).length
      : scored.length,
  );

  return scored.map(({ entry }, index) => ({
    entry,
    rank: ranks[index],
    tied: ranks.filter((rank) => rank === ranks[index]).length > 1,
  }));
}
