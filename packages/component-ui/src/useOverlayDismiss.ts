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

/**
 * Wires the focus and Escape behaviour every transient overlay owes a keyboard user:
 * focus moves in on open, Escape closes, and focus returns to whatever opened it.
 * Returns the ref to place on the overlay container.
 */
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
