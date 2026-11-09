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
      const width = element.offsetWidth;
      const height = element.offsetHeight;

      setSize((current) =>
        current?.width === width && current.height === height ? current : { width, height },
      );
    };

    updateSize();
    observerRef.current = new ResizeObserver(updateSize);
    observerRef.current.observe(element);
  }, []);

  return { ref, width: size?.width, height: size?.height };
}
