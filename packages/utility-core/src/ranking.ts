export function fuseRankedMatches<T>(
  rankings: readonly (readonly T[])[],
  key: (match: T) => string,
  offset = 60,
): Array<{ match: T; score: number }> {
  const fused = new Map<string, { match: T; score: number }>();

  for (const ranking of rankings) {
    const seen = new Set<string>();

    for (const [rank, match] of ranking.entries()) {
      const id = key(match);

      if (seen.has(id)) {
        continue;
      }

      seen.add(id);
      const score = 1 / (offset + rank + 1);
      const previous = fused.get(id);

      fused.set(id, { match: previous?.match ?? match, score: (previous?.score ?? 0) + score });
    }
  }

  return [...fused.values()].sort((left, right) => right.score - left.score);
}

export function toFtsQuery(query: string): string | null {
  const terms = query.match(/[\p{L}\p{N}_]+/gu)?.slice(0, 24);

  return terms?.length ? terms.map((term) => `"${term}"`).join(" OR ") : null;
}
