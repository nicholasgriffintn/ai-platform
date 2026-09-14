export function normaliseIsoDateTime(value: string): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new RangeError("Invalid date-time value");
  }

  return new Date(timestamp).toISOString();
}
