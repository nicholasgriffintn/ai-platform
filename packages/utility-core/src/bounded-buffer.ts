export interface BoundedBuffer<T> {
  readonly size: number;
  add(value: T, weight: number): boolean;
  drain(): T[];
}

export function createBoundedBuffer<T>(options: {
  maxItems: number;
  maxWeight: number;
}): BoundedBuffer<T> {
  if (
    !Number.isSafeInteger(options.maxItems) ||
    options.maxItems < 1 ||
    !Number.isSafeInteger(options.maxWeight) ||
    options.maxWeight < 1
  ) {
    throw new RangeError("Buffer limits must be positive safe integers");
  }

  let entries: T[] = [];
  let totalWeight = 0;

  return {
    get size() {
      return entries.length;
    },
    add(value, weight) {
      if (!Number.isSafeInteger(weight) || weight < 0) {
        throw new RangeError("Buffer weight must be a non-negative safe integer");
      }

      if (entries.length >= options.maxItems || weight > options.maxWeight - totalWeight) {
        return false;
      }

      entries.push(value);
      totalWeight += weight;

      return true;
    },
    drain() {
      const pending = entries;

      entries = [];
      totalWeight = 0;

      return pending;
    },
  };
}
