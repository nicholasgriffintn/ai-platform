export function toFtsQuery(query: string): string | null {
  const terms = [...new Set(query.match(/[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 32);

  return terms.length > 0 ? terms.map((term) => `"${term}"`).join(" OR ") : null;
}

export function fuseRankedResults<T extends { id: string }>(
  rankings: readonly (readonly T[])[],
  limit: number,
): Array<T & { score: number }> {
  const results = new Map<string, T & { score: number }>();

  for (const ranking of rankings) {
    const seen = new Set<string>();

    for (const [rank, result] of ranking.entries()) {
      if (seen.has(result.id)) {
        continue;
      }

      seen.add(result.id);
      const existing = results.get(result.id);

      results.set(result.id, { ...result, score: (existing?.score ?? 0) + 1 / (61 + rank) });
    }
  }

  return [...results.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
