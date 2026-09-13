import { useEffect, useRef, useState } from "react";

export function useDeferredPetPreview(enabled: boolean) {
  const previewRef = useRef<HTMLSpanElement | null>(null);
  const [ready, setReady] = useState(!enabled);
  const [prevEnabled, setPrevEnabled] = useState(enabled);

  if (prevEnabled !== enabled) {
    setPrevEnabled(enabled);

    if (!enabled) {
      setReady(true);
    }
  }

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const preview = previewRef.current;

    if (!preview || typeof IntersectionObserver === "undefined") {
      setReady(true);

      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );

    observer.observe(preview);

    return () => observer.disconnect();
  }, [enabled]);

  return { previewRef, ready };
}
