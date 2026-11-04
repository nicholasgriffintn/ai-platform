import type { DiscoverFeedItem } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useMemo, useState } from "react";

export function readDiscoverVisitBoundary(items: readonly DiscoverFeedItem[]): number | null {
  const seen = items
    .filter((item) => item.seen && item.card.kind === "read")
    .map((item) => item.sequence);

  return seen.length > 0 ? Math.max(...seen) : null;
}

export function listDiscoverNewCards(
  items: readonly DiscoverFeedItem[],
  boundary: number | null,
): Set<string> | null {
  return boundary === null
    ? null
    : new Set(items.filter((item) => item.sequence > boundary).map((item) => item.card.id));
}

export function useDiscoverSinceLastVisit(items: readonly DiscoverFeedItem[]): Set<string> | null {
  const [boundary, setBoundary] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (boundary === undefined && items.length > 0) {
      setBoundary(readDiscoverVisitBoundary(items));
    }
  }, [boundary, items]);

  return useMemo(() => listDiscoverNewCards(items, boundary ?? null), [boundary, items]);
}
