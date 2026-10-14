import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { useRef } from "react";

const WIDTH_STEP = 24;

interface WorkbenchDockResizeOptions {
  containerRef: RefObject<HTMLElement | null>;
  containerWidth?: number;
  width: number;
  minWidth: number;
  maxWidth: number;
  minConversationWidth: number;
  onWidthChange: (width: number) => void;
}

function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
}

export function useWorkbenchDockResize({
  containerRef,
  containerWidth,
  width,
  minWidth,
  maxWidth,
  minConversationWidth,
  onWidthChange,
}: WorkbenchDockResizeOptions) {
  const isDraggingRef = useRef(false);
  const effectiveMaxWidth = containerWidth
    ? Math.min(maxWidth, Math.max(minWidth, containerWidth - minConversationWidth))
    : maxWidth;
  const effectiveWidth = clampWidth(width, minWidth, effectiveMaxWidth);

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

    const availableMaxWidth = Math.min(
      maxWidth,
      Math.max(minWidth, bounds.width - minConversationWidth),
    );

    onWidthChange(clampWidth(bounds.right - event.clientX, minWidth, availableMaxWidth));
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    isDraggingRef.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextWidth = effectiveWidth;

    if (event.key === "ArrowLeft") {
      nextWidth += WIDTH_STEP;
    } else if (event.key === "ArrowRight") {
      nextWidth -= WIDTH_STEP;
    } else if (event.key === "Home") {
      nextWidth = minWidth;
    } else if (event.key === "End") {
      nextWidth = effectiveMaxWidth;
    } else {
      return;
    }

    event.preventDefault();
    onWidthChange(clampWidth(nextWidth, minWidth, effectiveMaxWidth));
  };

  return {
    effectiveMaxWidth,
    effectiveWidth,
    resizeHandleProps: {
      onKeyDown: handleKeyDown,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  };
}
