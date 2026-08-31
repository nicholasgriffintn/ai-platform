export function hasUniqueValues(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}
