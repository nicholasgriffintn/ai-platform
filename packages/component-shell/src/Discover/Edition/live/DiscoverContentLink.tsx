import type { DiscoverCard, DiscoverFeedItem } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

export function DiscoverContentLink({
  items,
  onSelect,
  onListen,
  hasMore,
  isLoadingMore,
  loadMore,
}: {
  items: readonly DiscoverFeedItem[];
  onSelect: (card: DiscoverCard) => void;
  onListen: (id: string) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const itemId = params.get("discoverItem");
  const briefingId = params.get("discoverBriefing");
  const id = itemId ?? briefingId ?? params.get("discoverObservation");
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!id || handled.current === id) {
      return;
    }

    const card = items.find((item) => item.id === itemId)?.card;

    if (itemId && !card) {
      if (hasMore) {
        if (!isLoadingMore) {
          loadMore();
        }

        return;
      }
    }

    handled.current = id;
    if (card) {
      onSelect(card);
    }

    if (briefingId) {
      onListen(briefingId);
    }

    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        next.delete("discoverItem");
        next.delete("discoverBriefing");
        next.delete("discoverObservation");

        return next;
      },
      { replace: true },
    );
  }, [
    id,
    items,
    onListen,
    onSelect,
    setParams,
    itemId,
    briefingId,
    hasMore,
    isLoadingMore,
    loadMore,
  ]);

  return null;
}
