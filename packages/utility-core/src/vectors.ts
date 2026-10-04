export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (!left.length || left.length !== right.length) {
    throw new RangeError("Embedding vectors must have equal, non-zero dimensions");
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (const [index, value] of left.entries()) {
    const other = right[index];

    if (!Number.isFinite(value) || other === undefined || !Number.isFinite(other)) {
      throw new RangeError("Embedding vectors must contain finite numbers");
    }

    dot += value * other;
    leftNorm += value * value;
    rightNorm += other * other;
  }

  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);

  if (!denominator || !Number.isFinite(denominator) || !Number.isFinite(dot)) {
    throw new RangeError("Embedding vectors must have finite, non-zero norms");
  }

  return Math.max(-1, Math.min(1, dot / denominator));
}
