import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";

const BUCKET_PRECISION = 0x100000000;

export async function bucketFor(targetingKey: string, salt: string): Promise<number> {
  const digest = await sha256Hex(`${salt}\u0000${targetingKey}`);

  return Number.parseInt(digest.slice(0, 8), 16) / BUCKET_PRECISION;
}

export interface WeightedEntry<TKey extends string = string> {
  key: TKey;
  weight: number;
}

export function pickWeighted<TKey extends string>(
  bucket: number,
  entries: readonly WeightedEntry<TKey>[],
): TKey | undefined {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);

  if (total <= 0) {
    return undefined;
  }

  const target = Math.min(Math.max(bucket, 0), 1 - Number.EPSILON) * total;
  let cumulative = 0;

  for (const entry of entries) {
    cumulative += Math.max(0, entry.weight);

    if (target < cumulative) {
      return entry.key;
    }
  }

  return entries.at(-1)?.key;
}

export function evenWeights<TKey extends string>(keys: readonly TKey[]): WeightedEntry<TKey>[] {
  return keys.map((key) => ({ key, weight: 1 }));
}
