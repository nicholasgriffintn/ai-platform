import { useEffect, useRef, useState } from "react";

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number>();

  useEffect(() => {
    const element = ref.current;

    if (!element || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const updateWidth = () => setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(updateWidth);

    updateWidth();
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
