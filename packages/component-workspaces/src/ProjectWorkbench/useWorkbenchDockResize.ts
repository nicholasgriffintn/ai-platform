import type { KeyboardEvent, PointerEvent } from "react";
import { useRef } from "react";

const WIDTH_STEP = 24;

interface WorkbenchDockResizeOptions {
  width: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange: (width: number) => void;
}

function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
}

export function useWorkbenchDockResize({
  width,
  minWidth,
  maxWidth,
  onWidthChange,
}: WorkbenchDockResizeOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current) {
      return;
    }

    const bounds = containerRef.current?.getBoundingClientRect();

    if (!bounds) {
      return;
    }

    onWidthChange(clampWidth(bounds.right - event.clientX, minWidth, maxWidth));
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    isDraggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextWidth = width;

    if (event.key === "ArrowLeft") {
      nextWidth += WIDTH_STEP;
    } else if (event.key === "ArrowRight") {
      nextWidth -= WIDTH_STEP;
    } else if (event.key === "Home") {
      nextWidth = minWidth;
    } else if (event.key === "End") {
      nextWidth = maxWidth;
    } else {
      return;
    }

    event.preventDefault();
    onWidthChange(clampWidth(nextWidth, minWidth, maxWidth));
  };

  return {
    containerRef,
    resizeHandleProps: {
      onKeyDown: handleKeyDown,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
}
