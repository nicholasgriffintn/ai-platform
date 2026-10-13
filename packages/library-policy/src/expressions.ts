export function cedarString(value: string): string {
  return JSON.stringify(value);
}

export function cedarStringSet(values: readonly string[]): string {
  return `[${values.map(cedarString).join(", ")}]`;
}

export function cedarStringInSet(
  values: readonly string[],
  expression: string,
  negated = false,
): string {
  const membership = `${cedarStringSet(values)}.contains(${expression})`;

  return negated ? `!${membership}` : membership;
}

export function cedarLong(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Cedar integer values must be safe integers");
  }

  return String(value);
}
