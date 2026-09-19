import { useEffect, useState, type MouseEvent } from "react";

export interface SiteSelectionProps {
  selectedKey: string | null;
  active: boolean;
  root: HTMLElement | null;
}

interface SelectionBox {
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
}

function isElementLike(target: EventTarget | null): target is Element {
  return Boolean(target) && typeof (target as Element).closest === "function";
}

export function findSiteElementKey(target: EventTarget | null): string | null {
  return isElementLike(target)
    ? (target.closest("[data-site-key]")?.getAttribute("data-site-key") ?? null)
    : null;
}

export function readSiteSelectionFromEvent(event: MouseEvent): string | null {
  return findSiteElementKey(event.target);
}

function measure(root: HTMLElement, key: string): SelectionBox | null {
  const wrapper = root.querySelector(`[data-site-key="${key}"]`);

  if (!wrapper) {
    return null;
  }

  const rects = [...wrapper.children]
    .map((child) => child.getBoundingClientRect())
    .filter((rect) => rect.width > 0 || rect.height > 0);

  if (rects.length === 0) {
    return null;
  }

  const view = root.ownerDocument.defaultView;
  const scrollX = view?.scrollX ?? 0;
  const scrollY = view?.scrollY ?? 0;
  const top = Math.min(...rects.map((rect) => rect.top));
  const left = Math.min(...rects.map((rect) => rect.left));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const right = Math.max(...rects.map((rect) => rect.right));

  return {
    top: top + scrollY,
    left: left + scrollX,
    width: right - left,
    height: bottom - top,
    label: `${wrapper.getAttribute("data-site-type") ?? ""} · ${key}`,
  };
}

export function SiteSelectionOverlay({ selectedKey, active, root }: SiteSelectionProps) {
  const [box, setBox] = useState<SelectionBox | null>(null);

  useEffect(() => {
    if (!root || !selectedKey) {
      setBox(null);

      return undefined;
    }

    const update = () => setBox(measure(root, selectedKey));
    const view = root.ownerDocument.defaultView;

    update();

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);

    observer?.observe(root);
    view?.addEventListener("scroll", update, true);
    view?.addEventListener("resize", update);

    return () => {
      observer?.disconnect();
      view?.removeEventListener("scroll", update, true);
      view?.removeEventListener("resize", update);
    };
  }, [root, selectedKey]);

  if (!box) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: box.top - 2,
        left: box.left - 2,
        width: box.width + 4,
        height: box.height + 4,
        border: "2px solid var(--ring)",
        borderRadius: 6,
        pointerEvents: "none",
        zIndex: 50,
        boxShadow: active
          ? "0 0 0 4px color-mix(in oklab, var(--ring) 20%, transparent)"
          : undefined,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -22,
          left: -2,
          fontSize: 11,
          lineHeight: "18px",
          padding: "0 6px",
          borderRadius: 4,
          background: "var(--ring)",
          color: "var(--primary-foreground)",
          whiteSpace: "nowrap",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {box.label}
      </span>
    </div>
  );
}
