import type { UsageEventRecord, UsageEventsResponse } from "@ngriffin_uk/polychat-schemas";

export function getNextUsageEventsPageParam(lastPage: UsageEventsResponse): string | undefined {
  return lastPage.next_cursor ?? undefined;
}

export function flattenUsageEventPages(
  pages: UsageEventsResponse[] | undefined,
): UsageEventRecord[] {
  if (!pages) {
    return [];
  }

  const seen = new Set<string>();
  const events: UsageEventRecord[] = [];

  for (const page of pages) {
    for (const event of page.events) {
      if (!seen.has(event.id)) {
        seen.add(event.id);
        events.push(event);
      }
    }
  }

  return events;
}
