export function sortCopy<T>(values: readonly T[], compare: (left: T, right: T) => number): T[] {
  return [...values].sort(compare);
}

export function reverseCopy<T>(values: readonly T[]): T[] {
  return [...values].reverse();
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function sampleDeterministic<T>(values: readonly T[], count: number, seed: string): T[] {
  if (count >= values.length) {
    return [...values];
  }

  let state = hashSeed(seed) || 1;
  const pool = [...values];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;

    const swap = (state >>> 0) % (index + 1);

    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }

  return pool.slice(0, count);
}

export function chunkArray<T>(values: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`Chunk size must be a positive integer, got ${size}`);
  }

  const chunks: T[][] = [];

  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }

  return chunks;
}
