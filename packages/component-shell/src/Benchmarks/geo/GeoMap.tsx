import type { GeoPoint } from "@ngriffin_uk/polychat-utility-core";
import type { MouseEvent } from "react";

import { fromMapPoint, toMapPoint } from "./map-projection.js";
import { WORLD_OUTLINE } from "./world-outline.js";

export interface GeoMapPair {
  id: string;
  truth: GeoPoint | null;
  guess: GeoPoint | null;
  label: string;
  active?: boolean;
}

export function GeoMap({
  pairs,
  onPick,
  ariaLabel,
}: {
  pairs: readonly GeoMapPair[];
  onPick?: (point: GeoPoint) => void;
  ariaLabel: string;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!onPick) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const point = fromMapPoint(
      ((event.clientX - bounds.left) / bounds.width) * WORLD_OUTLINE.width,
      ((event.clientY - bounds.top) / bounds.height) * WORLD_OUTLINE.height,
    );

    if (point) {
      onPick(point);
    }
  };

  const map = (
    <svg
      viewBox={`0 0 ${WORLD_OUTLINE.width} ${WORLD_OUTLINE.height}`}
      role={onPick ? undefined : "img"}
      aria-hidden={onPick ? true : undefined}
      aria-label={onPick ? undefined : ariaLabel}
      className="block h-auto w-full rounded-xl bg-active-work/5"
    >
      <path d={WORLD_OUTLINE.path} className="fill-muted-foreground/20" />
      {pairs.map((pair) => {
        const truth = pair.truth ? toMapPoint(pair.truth) : null;
        const guess = pair.guess ? toMapPoint(pair.guess) : null;
        const opacity = pair.active === false ? 0.25 : 1;

        return (
          <g key={pair.id} opacity={opacity}>
            <title>{pair.label}</title>
            {truth && guess ? (
              <line
                x1={truth.x}
                y1={truth.y}
                x2={guess.x}
                y2={guess.y}
                className="stroke-accent-amber"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            ) : null}
            {truth ? (
              <circle cx={truth.x} cy={truth.y} r={4.5} className="fill-success stroke-canvas" />
            ) : null}
            {guess ? (
              <circle
                cx={guess.x}
                cy={guess.y}
                r={4.5}
                className="fill-accent-amber stroke-canvas"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );

  return onPick ? (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      className="block w-full cursor-crosshair rounded-xl focus-visible:ring-2 focus-visible:ring-active-work"
    >
      {map}
    </button>
  ) : (
    map
  );
}
