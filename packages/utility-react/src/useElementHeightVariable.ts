import { useCallback, useRef } from "react";

export function useElementHeightVariable<TSource extends HTMLElement, TTarget extends HTMLElement>(
  variable: string,
) {
  const targetRef = useRef<TTarget | null>(null);
  const sourceRef = useCallback(
    (element: TSource | null) => {
      if (!element || typeof ResizeObserver === "undefined") {
        return undefined;
      }

      const update = () =>
        targetRef.current?.style.setProperty(
          variable,
          `${element.getBoundingClientRect().height}px`,
        );
      const observer = new ResizeObserver(update);

      update();
      observer.observe(element);

      return () => observer.disconnect();
    },
    [variable],
  );

  return { sourceRef, targetRef };
}
