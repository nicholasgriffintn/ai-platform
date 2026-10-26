export function keepLatestRecordEntries<T>(
  record: Record<string, T>,
  limit: number,
): Record<string, T> {
  const entries = Object.entries(record);

  return entries.length <= limit
    ? record
    : Object.fromEntries(entries.slice(entries.length - limit));
}

export function toggleSetMember<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);

  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }

  return next;
}

export function groupBy<T, K>(items: Iterable<T>, keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);

    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return groups;
}
