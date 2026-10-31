import { useLingeringValue } from "@ngriffin_uk/polychat-utility-react";
import { useCallback, useLayoutEffect, useRef } from "react";

import { discoverItemKey, type DiscoverItem } from "./discover-items.js";
import {
  captureDiscoverMorph,
  PANEL_CLOSE_MS,
  PANEL_OPEN_MS,
  playDiscoverEntrance,
  playDiscoverMorph,
  type DiscoverMorphSource,
} from "./discover-motion.js";

const ART_TARGET = "[data-discover-art-target], [data-media-visual]";

interface FeedAnchor {
  key: string;
  top: number;
}

function findFeedItem(feed: HTMLElement | null, key: string): HTMLElement | null {
  const element = feed?.querySelector(`[data-discover-item="${CSS.escape(key)}"]`);

  return element instanceof HTMLElement ? element : null;
}

function revealInFeed(feed: HTMLElement, element: HTMLElement) {
  const bounds = feed.getBoundingClientRect();
  const rect = element.getBoundingClientRect();

  if (rect.top < bounds.top || rect.bottom > bounds.bottom) {
    element.scrollIntoView({ block: "center" });
  }
}

export function useDiscoverPanelMotion(item: DiscoverItem | null) {
  const open = item !== null;
  const shown = useLingeringValue(item, PANEL_CLOSE_MS);
  const occupied = shown !== null;
  const shownKey = shown ? discoverItemKey(shown) : null;
  const panelRef = useRef<HTMLElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const morphRef = useRef<DiscoverMorphSource | null>(null);
  const anchorRef = useRef<FeedAnchor | null>(null);
  const openedAtRef = useRef(0);

  useLayoutEffect(() => {
    if (open) {
      openedAtRef.current = performance.now();
    }
  }, [open]);

  useLayoutEffect(() => {
    const feed = feedRef.current;
    const element = !open && shownKey ? findFeedItem(feed, shownKey) : null;

    if (!feed || !element || !shownKey) {
      return;
    }

    revealInFeed(feed, element);
    anchorRef.current = { key: shownKey, top: element.getBoundingClientRect().top };
  }, [open, shownKey]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const feed = feedRef.current;

    anchorRef.current = null;

    if (!anchor || !feed || feed.offsetParent === null) {
      return;
    }

    const element = findFeedItem(feed, anchor.key);

    if (element) {
      feed.scrollTop += element.getBoundingClientRect().top - anchor.top;
    }
  }, [occupied]);

  const capture = useCallback((target: EventTarget | null) => {
    const host = target instanceof Element ? target.closest("[data-discover-item]") : null;
    const key = host?.getAttribute("data-discover-item");

    morphRef.current = captureDiscoverMorph(host);
    anchorRef.current = key && host ? { key, top: host.getBoundingClientRect().top } : null;
  }, []);

  const playEntrance = useCallback((content: HTMLElement | null) => {
    if (!content) {
      return;
    }

    const morph = morphRef.current;
    const target = content.querySelector(ART_TARGET);

    morphRef.current = null;

    if (
      morph &&
      morph.key === content.dataset.discoverPanelItem &&
      target instanceof HTMLElement &&
      panelRef.current
    ) {
      playDiscoverMorph(morph, target, panelRef.current);
    }

    const openedAt = openedAtRef.current;
    const opening = performance.now() - openedAt < PANEL_OPEN_MS;

    playDiscoverEntrance(content, opening ? "open" : "switch", openedAt);
  }, []);

  return { open, shown, occupied, panelRef, feedRef, capture, playEntrance };
}
