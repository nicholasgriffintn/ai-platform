import { type PointerEventHandler, useCallback, useEffect, useRef, useState } from "react";

export function useDelayedHover({ delayMs, disabled }: { delayMs: number; disabled: boolean }) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearPending();
    setIsVisible(false);
  }, [clearPending]);

  const onPointerMove = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (disabled || event.pointerType === "touch" || isVisible || timeoutRef.current !== null) {
        return;
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setIsVisible(true);
      }, delayMs);
    },
    [delayMs, disabled, isVisible],
  );

  useEffect(() => {
    if (disabled) {
      hide();
    }
  }, [disabled, hide]);

  useEffect(() => clearPending, [clearPending]);

  return {
    isVisible,
    onPointerCancel: hide,
    onPointerDown: hide,
    onPointerLeave: hide,
    onPointerMove,
  };
}
