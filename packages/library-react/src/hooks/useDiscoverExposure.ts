import type { DiscoverFeedItem } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useRef } from "react";

import { useMarkDiscoverSeen } from "./useDiscoverDay.js";

const DISCOVER_EXPOSURE_TARGET = "[data-discover-item], [data-discover-feed-id]";

export function useDiscoverExposure(items: readonly DiscoverFeedItem[]) {
  const root = useRef<HTMLDivElement>(null);
  const recorded = useRef(new Map<string, number>());
  const { mutate } = useMarkDiscoverSeen();

  useEffect(() => {
    const element = root.current;

    if (!element || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const visible = new Map<string, DiscoverFeedItem>();
    const pending = new Map<string, DiscoverFeedItem>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      flushTimer = undefined;
      const batch = [...pending.values()].slice(0, 48);

      for (const item of batch) {
        pending.delete(item.id);
        recorded.current.set(item.id, item.revision);
      }

      if (batch.length > 0) {
        mutate(
          { items: batch.map((item) => ({ id: item.id, revision: item.revision })) },
          {
            onError: () => {
              for (const item of batch) {
                recorded.current.delete(item.id);
              }
            },
          },
        );
      }

      if (pending.size > 0) {
        flushTimer = setTimeout(flush, 250);
      }
    };

    const resetVisibility = () => {
      if (document.visibilityState === "visible") {
        for (const card of element.querySelectorAll(DISCOVER_EXPOSURE_TARGET)) {
          observer.unobserve(card);
          observer.observe(card);
        }

        return;
      }

      visible.clear();
      pending.clear();
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }

      timers.clear();
      clearTimeout(flushTimer);
      flushTimer = undefined;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id =
            entry.target.getAttribute("data-discover-feed-id") ??
            entry.target.getAttribute("data-discover-item")?.replace(/^card:/u, "");
          const item = items.find((candidate) => candidate.id === id);

          if (!id || !item || item.seen || recorded.current.get(id) === item.revision) {
            continue;
          }

          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.6 &&
            document.visibilityState === "visible"
          ) {
            visible.set(id, item);

            if (!timers.has(id)) {
              timers.set(
                id,
                setTimeout(() => {
                  timers.delete(id);
                  const shown = visible.get(id);

                  if (shown && document.visibilityState === "visible") {
                    pending.set(id, shown);
                    flushTimer ??= setTimeout(flush, 250);
                  }
                }, 1000),
              );
            }
          } else {
            visible.delete(id);
            clearTimeout(timers.get(id));
            timers.delete(id);
          }
        }
      },
      { threshold: [0, 0.6] },
    );

    for (const card of element.querySelectorAll(DISCOVER_EXPOSURE_TARGET)) {
      observer.observe(card);
    }

    document.addEventListener("visibilitychange", resetVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", resetVisibility);
      clearTimeout(flushTimer);
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, [items, mutate]);

  return root;
}
