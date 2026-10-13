import type {
  BenchmarkDefinition,
  BenchmarkItem,
  ItemScore,
  ScoredAnswer,
  Benchmark,
} from "./types.js";

export const INVALID_ANSWER: ItemScore = { score: 0, detail: { invalid: true } };

export function gateScore(reasons: readonly string[]): ItemScore {
  return reasons.length === 0
    ? { score: 1, detail: { gate: true } }
    : { score: 0, detail: { gate: false, reason: reasons.join(", ") } };
}

export function benchmarkPhotoPath(benchmarkId: string, itemId: string): string {
  return `/benchmarks/${benchmarkId}/photos/${encodeURIComponent(itemId)}`;
}

export function defineBenchmark<TTruth, TAnswer>(
  definition: BenchmarkDefinition<TTruth, TAnswer>,
): Benchmark {
  const items = new Map(definition.items.map((item) => [item.id, item]));

  const requireItem = (itemId: string): BenchmarkItem<TTruth> => {
    const item = items.get(itemId);

    if (!item) {
      throw new Error(`Unknown ${definition.summary.id} item ${itemId}`);
    }

    return item;
  };

  const validateAnswer = (value: unknown): TAnswer | null => {
    const parsed = definition.answerSchema.safeParse(value);

    return parsed.success ? parsed.data : null;
  };

  return {
    summary: { ...definition.summary, itemCount: definition.items.length },
    itemIds: definition.items.map((item) => item.id),
    judgeRubric: definition.judgeRubric ?? null,
    hasItem: (itemId) => items.has(itemId),
    prompt: (itemId) => definition.prompt(requireItem(itemId)),
    decision: (itemId) => definition.decision?.(requireItem(itemId)) ?? null,
    fromDecision: (probability) => definition.fromDecision?.(probability) ?? null,
    parseOutput: (output) => validateAnswer(definition.parse(output)),
    validateAnswer,
    score: (itemId, answer) => {
      const valid = validateAnswer(answer);

      return valid === null ? INVALID_ANSWER : definition.score(requireItem(itemId), valid);
    },
    artefact: (itemId, answer) => {
      const valid = validateAnswer(answer);

      if (valid === null || !definition.artefact) {
        return null;
      }

      return definition.score(requireItem(itemId), valid).score > 0
        ? definition.artefact(valid)
        : null;
    },
    publicItem: (itemId) => {
      const item = requireItem(itemId);
      const prompt = definition.prompt(item);

      return {
        id: item.id,
        prompt: prompt.user,
        imagePath: prompt.imageItemId
          ? benchmarkPhotoPath(definition.summary.id, prompt.imageItemId)
          : null,
        data: definition.publicData?.(item) ?? {},
      };
    },
    reveal: (itemId) => definition.reveal(requireItem(itemId)),
    metrics: (results) =>
      definition.metrics?.(
        results.map((result): ScoredAnswer<TAnswer> => ({
          ...result,
          answer: validateAnswer(result.answer),
        })),
      ) ?? {},
  };
}
