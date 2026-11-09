const SETTLE_MS = 450;
const HOLD_LIMIT_MS = 3000;
const DRIFT_TOLERANCE_PX = 0.5;
const ITEM_SELECTOR = "[data-discover-item]";

export interface FeedAnchor {
  key: string;
  top: number | null;
}

export function findFeedItem(feed: HTMLElement | null, key: string): HTMLElement | null {
  const element = feed?.querySelector(`[data-discover-item="${CSS.escape(key)}"]`);

  return element instanceof HTMLElement ? element : null;
}

function isShown(feed: HTMLElement): boolean {
  return feed.offsetParent !== null;
}

function offsetInFeed(feed: HTMLElement, element: HTMLElement): number {
  return element.getBoundingClientRect().top - feed.getBoundingClientRect().top;
}

function firstVisibleItem(feed: HTMLElement): HTMLElement | null {
  const feedTop = feed.getBoundingClientRect().top;

  for (const element of feed.querySelectorAll(ITEM_SELECTOR)) {
    if (element instanceof HTMLElement && element.getBoundingClientRect().bottom > feedTop) {
      return element;
    }
  }

  return null;
}

export function readFeedAnchor(feed: HTMLElement | null, host: Element | null): FeedAnchor | null {
  if (!feed || !isShown(feed)) {
    return null;
  }

  const element = host instanceof HTMLElement ? host : firstVisibleItem(feed);
  const key = element?.getAttribute("data-discover-item");

  return element && key ? { key, top: offsetInFeed(feed, element) } : null;
}

function targetOffset(feed: HTMLElement, element: HTMLElement, anchor: FeedAnchor): number {
  return anchor.top ?? Math.max(0, (feed.clientHeight - element.offsetHeight) / 2);
}

export function holdFeedAnchor(feed: HTMLElement, anchor: FeedAnchor): () => void {
  const startedAt = performance.now();
  let settlesAt = startedAt + SETTLE_MS;
  let frame = 0;
  let stopped = false;
  const resizes = new ResizeObserver(() => {
    settlesAt = performance.now() + SETTLE_MS;
  });

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    resizes.disconnect();
    feed.removeEventListener("wheel", stop);
    feed.removeEventListener("touchstart", stop);
    feed.removeEventListener("keydown", stop);
  };

  const align = () => {
    if (stopped) {
      return;
    }

    const element = findFeedItem(feed, anchor.key);

    if (element && isShown(feed)) {
      const drift = offsetInFeed(feed, element) - targetOffset(feed, element, anchor);

      if (Math.abs(drift) > DRIFT_TOLERANCE_PX) {
        feed.scrollTop += drift;
      }
    }

    const now = performance.now();

    if (now < settlesAt && now - startedAt < HOLD_LIMIT_MS) {
      frame = requestAnimationFrame(align);
    } else {
      stop();
    }
  };

  resizes.observe(feed);

  if (feed.firstElementChild) {
    resizes.observe(feed.firstElementChild);
  }

  feed.addEventListener("wheel", stop, { passive: true });
  feed.addEventListener("touchstart", stop, { passive: true });
  feed.addEventListener("keydown", stop);
  align();

  return stop;
}
