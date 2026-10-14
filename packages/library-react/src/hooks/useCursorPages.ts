import { useCallback, useState } from "react";

export function useCursorPages() {
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);

  const next = useCallback((cursor: string | undefined) => {
    if (cursor) {
      setCursors((current) => [...current, cursor]);
    }
  }, []);

  const previous = useCallback(() => {
    setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const reset = useCallback(() => setCursors([undefined]), []);

  return {
    cursor: cursors.at(-1),
    page: cursors.length,
    hasPrevious: cursors.length > 1,
    next,
    previous,
    reset,
  };
}
