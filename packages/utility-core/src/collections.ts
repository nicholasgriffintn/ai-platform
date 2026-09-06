export function keepLatestRecordEntries<T>(
  record: Record<string, T>,
  limit: number,
): Record<string, T> {
  const entries = Object.entries(record);

  return entries.length <= limit
    ? record
    : Object.fromEntries(entries.slice(entries.length - limit));
}
