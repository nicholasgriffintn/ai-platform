export function dotProduct(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

export function normaliseVector(vector: readonly number[]): number[] {
  const size = Math.sqrt(dotProduct(vector, vector));

  return size > 0 ? vector.map((value) => value / size) : [...vector];
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const size = Math.sqrt(dotProduct(left, left) * dotProduct(right, right));

  return size > 0 ? dotProduct(left, right) / size : 0;
}

export function blendVectors(
  base: readonly number[],
  weight: number,
  addition: readonly number[],
): number[] {
  return normaliseVector(addition.map((value, index) => (base[index] ?? 0) * weight + value));
}
