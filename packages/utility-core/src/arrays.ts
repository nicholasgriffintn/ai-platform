export function sortCopy<T>(values: readonly T[], compare: (left: T, right: T) => number): T[] {
  return [...values].sort(compare);
}

export function reverseCopy<T>(values: readonly T[]): T[] {
  return [...values].reverse();
}
