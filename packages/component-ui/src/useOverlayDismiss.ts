import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface OverlayDismissOptions {
  /** Whether the overlay is currently rendered and interactive. */
  open: boolean;
  onClose: () => void;
  /** Set false when the overlay places initial focus itself. */
  autoFocus?: boolean;
}

export function useOverlayDismiss<T extends HTMLElement>({
  open,
  onClose,
  autoFocus = true,
}: OverlayDismissOptions): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const ownerDocument = containerRef.current?.ownerDocument ?? globalThis.document;

    if (!ownerDocument) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();

        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const container = containerRef.current;

      if (!container) {
        return;
      }

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();

        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = ownerDocument.activeElement;
      const outside = !active || !container.contains(active);

      if (event.shiftKey) {
        if (outside || active === first || active === container) {
          event.preventDefault();
          last.focus();
        }

        return;
      }

      if (outside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    ownerDocument.addEventListener("keydown", handleKeyDown);

    return () => ownerDocument.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const container = containerRef.current;
    const ownerDocument = container?.ownerDocument ?? globalThis.document;
    const previouslyFocused = ownerDocument?.activeElement as HTMLElement | null;

    if (autoFocus && container) {
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);

      (firstFocusable ?? container).focus();
    }

    return () => {
      // Only restore when the opener is still on the page; a route change makes it stale.
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open, autoFocus]);

  return containerRef;
}
