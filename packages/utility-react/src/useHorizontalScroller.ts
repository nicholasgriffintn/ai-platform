import { useCallback, useRef, useState } from "react";

interface ScrollEdges {
  start: boolean;
  end: boolean;
}

export interface HorizontalScrollState {
  canScrollStart: boolean;
  canScrollEnd: boolean;
  overflowing: boolean;
  scrollByPage: (direction: -1 | 1) => void;
}

const NO_EDGES: ScrollEdges = { start: false, end: false };

function readEdges(element: HTMLElement): ScrollEdges {
  return {
    start: element.scrollLeft > 1,
    end: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
  };
}

export function useHorizontalScroller<T extends HTMLElement>(): HorizontalScrollState & {
  ref: (element: T | null) => (() => void) | undefined;
} {
  const elementRef = useRef<T | null>(null);
  const [edges, setEdges] = useState<ScrollEdges>(NO_EDGES);

  const ref = useCallback((element: T | null) => {
    elementRef.current = element;

    if (!element) {
      return undefined;
    }

    const update = () => {
      const next = readEdges(element);

      setEdges((current) =>
        current.start === next.start && current.end === next.end ? current : next,
      );
    };

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);

    update();
    element.addEventListener("scroll", update, { passive: true });
    observer?.observe(element);

    return () => {
      element.removeEventListener("scroll", update);
      observer?.disconnect();
      elementRef.current = null;
    };
  }, []);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const element = elementRef.current;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    element?.scrollBy({
      left: direction * element.clientWidth,
      behavior: reduced ? "auto" : "smooth",
    });
  }, []);

  return {
    ref,
    canScrollStart: edges.start,
    canScrollEnd: edges.end,
    overflowing: edges.start || edges.end,
    scrollByPage,
  };
}
