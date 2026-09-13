import { type PointerEventHandler, useCallback, useEffect, useRef, useState } from "react";

export function useDelayedHover({ delayMs, disabled }: { delayMs: number; disabled: boolean }) {
  const [isVisibleState, setIsVisibleState] = useState(false);
  const isVisible = disabled ? false : isVisibleState;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearPending();
    setIsVisibleState(false);
  }, [clearPending]);

  const onPointerMove = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (
        disabled ||
        event.pointerType === "touch" ||
        isVisibleState ||
        timeoutRef.current !== null
      ) {
        return;
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setIsVisibleState(true);
      }, delayMs);
    },
    [delayMs, disabled, isVisibleState],
  );

  useEffect(() => {
    if (disabled) {
      clearPending();
    }
  }, [disabled, clearPending]);

  useEffect(() => clearPending, [clearPending]);

  return {
    isVisible,
    onPointerCancel: hide,
    onPointerDown: hide,
    onPointerLeave: hide,
    onPointerMove,
  };
}
