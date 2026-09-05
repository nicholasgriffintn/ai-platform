import type { PointerEvent as ReactPointerEvent } from "react";
import { useState } from "react";

export interface ProjectWorkbenchPreviewRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PreviewPoint {
  x: number;
  y: number;
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function eventPoint(event: ReactPointerEvent<HTMLElement>): PreviewPoint {
  const bounds = event.currentTarget.getBoundingClientRect();

  return {
    x: clampPercentage(((event.clientX - bounds.left) / bounds.width) * 100),
    y: clampPercentage(((event.clientY - bounds.top) / bounds.height) * 100),
  };
}

function regionBetween(start: PreviewPoint, end: PreviewPoint): ProjectWorkbenchPreviewRegion {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  if (width >= 1 || height >= 1) {
    return { x, y, width, height };
  }

  return {
    x: clampPercentage(start.x - 2),
    y: clampPercentage(start.y - 2),
    width: Math.min(4, 100 - clampPercentage(start.x - 2)),
    height: Math.min(4, 100 - clampPercentage(start.y - 2)),
  };
}

export function usePreviewRegionSelection() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [start, setStart] = useState<PreviewPoint>();
  const [draft, setDraft] = useState<ProjectWorkbenchPreviewRegion>();
  const [region, setRegion] = useState<ProjectWorkbenchPreviewRegion>();

  const clear = () => {
    setStart(undefined);
    setDraft(undefined);
    setRegion(undefined);
    setIsSelecting(false);
  };

  return {
    isSelecting,
    region,
    draft,
    startSelecting: () => {
      setRegion(undefined);
      setDraft(undefined);
      setStart(undefined);
      setIsSelecting(true);
    },
    cancelSelecting: () => {
      setStart(undefined);
      setDraft(undefined);
      setIsSelecting(false);
    },
    clear,
    overlayProps: {
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!isSelecting) {
          return;
        }

        const point = eventPoint(event);

        event.currentTarget.setPointerCapture(event.pointerId);
        setStart(point);
        setDraft({ x: point.x, y: point.y, width: 0, height: 0 });
      },
      onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!isSelecting || !start) {
          return;
        }

        setDraft(regionBetween(start, eventPoint(event)));
      },
      onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!isSelecting || !start) {
          return;
        }

        const nextRegion = regionBetween(start, eventPoint(event));

        event.currentTarget.releasePointerCapture(event.pointerId);
        setRegion(nextRegion);
        setDraft(undefined);
        setStart(undefined);
        setIsSelecting(false);
      },
      onPointerCancel: () => {
        setStart(undefined);
        setDraft(undefined);
        setIsSelecting(false);
      },
    },
  };
}
