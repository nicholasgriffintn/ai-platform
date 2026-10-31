import { useCallback, useEffect, useRef, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

export function useElementSize<T extends HTMLElement>() {
  const observerRef = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState<ElementSize>();

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const ref = useCallback((element: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!element || typeof ResizeObserver === "undefined") {
      setSize(undefined);

      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();

      setSize((current) =>
        current?.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };

    updateSize();
    observerRef.current = new ResizeObserver(updateSize);
    observerRef.current.observe(element);
  }, []);

  return { ref, width: size?.width, height: size?.height };
}
