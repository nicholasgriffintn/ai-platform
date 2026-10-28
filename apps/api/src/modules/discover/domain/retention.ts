import { DISCOVER_EDITION_RETENTION_DAYS } from "@ngriffin_uk/polychat-schemas";
import { shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverFeedbackEntry } from "./feedback";

export function savedEditionIds(entries: readonly DiscoverFeedbackEntry[]): Set<string> {
  return new Set(entries.flatMap((entry) => (entry.signal === "saved" ? [entry.editionId] : [])));
}

export function selectExpiredEditions(
  editions: readonly { id: string; date: string }[],
  kept: ReadonlySet<string>,
  today: string,
): string[] {
  const cutoff = shiftCalendarDate(today, -DISCOVER_EDITION_RETENTION_DAYS);

  return editions.flatMap((edition) =>
    edition.date < cutoff && !kept.has(edition.id) ? [edition.id] : [],
  );
}
