import { useEffect, useRef } from "react";

import { isTextEntryTarget } from "./dom.js";

interface UseKeyHoldOptions {
  code: string;
  enabled: boolean;
  onPress: () => void;
  onRelease: () => void;
}

export function useKeyHold({ code, enabled, onPress, onRelease }: UseKeyHoldOptions): void {
  const onPressRef = useRef(onPress);
  const onReleaseRef = useRef(onRelease);

  useEffect(() => {
    onPressRef.current = onPress;
    onReleaseRef.current = onRelease;
  }, [onPress, onRelease]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let holding = false;

    const release = () => {
      if (!holding) {
        return;
      }

      holding = false;
      onReleaseRef.current();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== code ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTextEntryTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();

      if (holding) {
        return;
      }

      holding = true;
      onPressRef.current();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== code || !holding) {
        return;
      }

      event.preventDefault();
      release();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", release);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", release);
      release();
    };
  }, [code, enabled]);
}
