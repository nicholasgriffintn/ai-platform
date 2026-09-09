import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { VListHandle } from "virtua";

const BOTTOM_THRESHOLD_PX = 100;
const MOVEMENT_TOLERANCE_PX = 4;
const USER_INTENT_WINDOW_MS = 500;
const USER_INTENT_EVENTS = ["wheel", "keydown", "touchmove", "mousedown"] as const;

interface UseStickToBottomOptions {
  enabled: boolean;
  rowCount: number;
  followKey: string;
  resetKey: string;
}

interface StickToBottom {
  listRef: RefObject<VListHandle | null>;
  viewportRef: RefObject<HTMLElement | null>;
  showScrollButton: boolean;
  handleScroll: (offset: number) => void;
  scrollToBottom: () => void;
}

export function useStickToBottom({
  enabled,
  rowCount,
  followKey,
  resetKey,
}: UseStickToBottomOptions): StickToBottom {
  const listRef = useRef<VListHandle>(null);
  const viewportRef = useRef<HTMLElement>(null);
  const rowCountRef = useRef(rowCount);
  const isPinnedRef = useRef(true);
  const lastOffsetRef = useRef<number | null>(null);
  const lastUserIntentAtRef = useRef(0);
  const releasedAtRef = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    rowCountRef.current = rowCount;
  }, [rowCount]);

  const scrollToEnd = useCallback(() => {
    const list = listRef.current;
    const lastRowIndex = rowCountRef.current - 1;

    if (!list || lastRowIndex < 0) {
      return;
    }

    list.scrollToIndex(lastRowIndex, { align: "end" });
  }, []);

  useEffect(() => {
    isPinnedRef.current = true;
    releasedAtRef.current = 0;
    setShowScrollButton(false);
  }, [resetKey]);

  useEffect(() => {
    if (!enabled || !isPinnedRef.current) {
      return;
    }

    scrollToEnd();
  }, [enabled, followKey, resetKey, rowCount, scrollToEnd]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!enabled || !viewport) {
      return undefined;
    }

    const markUserIntent = () => {
      lastUserIntentAtRef.current = Date.now();
    };

    for (const eventName of USER_INTENT_EVENTS) {
      viewport.addEventListener(eventName, markUserIntent, { passive: true });
    }

    return () => {
      for (const eventName of USER_INTENT_EVENTS) {
        viewport.removeEventListener(eventName, markUserIntent);
      }
    };
  }, [enabled]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!enabled || !viewport || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      if (isPinnedRef.current) {
        scrollToEnd();
      }
    });

    observer.observe(viewport);

    return () => observer.disconnect();
  }, [enabled, scrollToEnd]);

  const handleScroll = useCallback((offset: number) => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const now = Date.now();
    const previousOffset = lastOffsetRef.current;

    lastOffsetRef.current = offset;

    const distanceFromBottom = list.scrollSize - (offset + list.viewportSize);
    const isAtBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
    const hasRecentIntent = now - lastUserIntentAtRef.current <= USER_INTENT_WINDOW_MS;
    const movedUp = previousOffset !== null && offset < previousOffset - MOVEMENT_TOLERANCE_PX;
    const movedDown = previousOffset !== null && offset > previousOffset + MOVEMENT_TOLERANCE_PX;

    if (hasRecentIntent && movedUp) {
      isPinnedRef.current = false;
      releasedAtRef.current = now;
    } else if (movedDown) {
      releasedAtRef.current = 0;
    }

    if (isAtBottom && now - releasedAtRef.current > USER_INTENT_WINDOW_MS) {
      isPinnedRef.current = true;
    }

    setShowScrollButton(!isPinnedRef.current);
  }, []);

  const scrollToBottom = useCallback(() => {
    isPinnedRef.current = true;
    releasedAtRef.current = 0;
    setShowScrollButton(false);
    scrollToEnd();
  }, [scrollToEnd]);

  return { listRef, viewportRef, showScrollButton, handleScroll, scrollToBottom };
}
