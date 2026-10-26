import { useCallback, useEffect } from "react";

export function useKeyboardShortcuts({ onSave }: { onSave: () => void }) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyS") {
        event.preventDefault();
        onSave();
      }
    },
    [onSave],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
