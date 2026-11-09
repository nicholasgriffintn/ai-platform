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
import { findFeedItem, holdFeedAnchor, readFeedAnchor, type FeedAnchor } from "./feed-anchor.js";

const ART_TARGET = "[data-discover-art-target], [data-media-visual]";

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
    const switched =
      !open && shownKey && anchorRef.current?.key !== shownKey
        ? findFeedItem(feedRef.current, shownKey)
        : null;

    if (switched && shownKey) {
      anchorRef.current = { key: shownKey, top: null };
    }
  }, [open, shownKey]);

  useLayoutEffect(() => {
    const feed = feedRef.current;
    const anchor = anchorRef.current;

    if (!open && !occupied) {
      anchorRef.current = null;
    }

    return feed && anchor ? holdFeedAnchor(feed, anchor) : undefined;
  }, [open, occupied]);

  const capture = useCallback((target: EventTarget | null) => {
    const host = target instanceof Element ? target.closest("[data-discover-item]") : null;

    morphRef.current = captureDiscoverMorph(host);
    anchorRef.current = readFeedAnchor(feedRef.current, host);
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
