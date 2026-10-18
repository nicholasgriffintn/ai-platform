import {
  POLY_DOCK_MAX_WIDTH,
  POLY_DOCK_MIN_WIDTH,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import { type KeyboardEvent, type PointerEvent, useRef } from "react";

import { LazyPolyPanel } from "./LazyPolyPanel.js";
import { PolyOpening } from "./PolyOpening.js";

const KEYBOARD_STEP = 24;

export function PolyDock() {
  const width = useUIStore((state) => state.polyDockWidth);
  const setWidth = useUIStore((state) => state.setPolyDockWidth);
  const setShowPoly = useUIStore((state) => state.setShowPoly);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    drag.current = { startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) {
      return;
    }

    setWidth(drag.current.startWidth + drag.current.startX - event.clientX);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setWidth(width + KEYBOARD_STEP);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setWidth(width - KEYBOARD_STEP);
    }
  };

  return (
    <aside
      aria-label="Poly"
      className="relative flex h-full min-h-0 shrink-0 flex-col border-l border-border bg-canvas pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]"
      style={{ width }}
    >
      <button
        type="button"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- window splitter pattern requires focusable separator with arrow-key resizing and valuemin/max/now; native hr is non-interactive and cannot host resize activation
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Poly"
        aria-valuemin={POLY_DOCK_MIN_WIDTH}
        aria-valuemax={POLY_DOCK_MAX_WIDTH}
        aria-valuenow={width}
        className="absolute inset-y-0 -left-1 z-10 m-0 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-border focus-visible:bg-ring/40 focus-visible:outline-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      />
      <LazyPolyPanel layout="dock" onClose={() => setShowPoly(false)} fallback={<PolyOpening />} />
    </aside>
  );
}
