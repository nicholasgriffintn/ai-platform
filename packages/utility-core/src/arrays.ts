export function sortCopy<T>(values: readonly T[], compare: (left: T, right: T) => number): T[] {
  return [...values].sort(compare);
}

export function reverseCopy<T>(values: readonly T[]): T[] {
  return [...values].reverse();
}

export function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createSeededGenerator(seed: string): () => number {
  let state = hashSeed(seed) || 1;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;

    return state >>> 0;
  };
}

export function createSeededRandom(seed: string): () => number {
  const next = createSeededGenerator(seed);

  return () => next() / 4_294_967_296;
}

export function sampleDeterministic<T>(values: readonly T[], count: number, seed: string): T[] {
  if (count >= values.length) {
    return [...values];
  }

  const next = createSeededGenerator(seed);
  const pool = [...values];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = next() % (index + 1);

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

const UINT32_RANGE = 0x1_0000_0000;

export function randomIndex(length: number): number {
  if (!Number.isInteger(length) || length <= 0 || length > UINT32_RANGE) {
    throw new RangeError("Length must be a positive 32-bit integer");
  }

  const limit = UINT32_RANGE - (UINT32_RANGE % length);
  const buffer = new Uint32Array(1);

  for (;;) {
    crypto.getRandomValues(buffer);

    if (buffer[0] < limit) {
      return buffer[0] % length;
    }
  }
}

export function pickRandom<T>(values: readonly T[]): T | undefined {
  return values.length === 0 ? undefined : values[randomIndex(values.length)];
}

export function shuffleCopy<T>(values: readonly T[]): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);

    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }

  return shuffled;
}

export function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return values.some((candidate) => candidate === value);
}
