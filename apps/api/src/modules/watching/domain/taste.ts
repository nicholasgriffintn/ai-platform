export interface TasteVector {
  id: string;
  values: readonly number[];
  weight: number;
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function normalise(vector: readonly number[]): number[] {
  const size = Math.sqrt(dot(vector, vector));

  return size > 0 ? vector.map((value) => value / size) : [...vector];
}

export function blendTaste(vectors: readonly TasteVector[]): number[] {
  const width = vectors[0]?.values.length ?? 0;
  const blended = Array.from({ length: width }, () => 0);

  for (const vector of vectors) {
    vector.values.forEach((value, index) => {
      blended[index] = (blended[index] ?? 0) + value * vector.weight;
    });
  }

  return normalise(blended);
}
