import { clampNumber } from "@ngriffin_uk/polychat-utility-core";
import { useElementSize, useHorizontalScroller } from "@ngriffin_uk/polychat-utility-react";
import type { CSSProperties, ReactNode } from "react";

import {
  DISCOVER_CAROUSEL_TRACK,
  DiscoverCarouselControls,
  DiscoverCarouselFade,
} from "./DiscoverCarousel.js";

const REM_PX = 16;
const SHELF_GAP_PX = 0.75 * REM_PX;
const SHELF_NARROW_PX = 40 * REM_PX;
const POSTER_MIN_NARROW_PX = 9.5 * REM_PX;
const POSTER_MIN_PX = 13 * REM_PX;
const POSTER_MAX_PX = 20 * REM_PX;

const POSTER_TRACK = `-m-1 flex scroll-px-1 gap-3 p-1 ${DISCOVER_CAROUSEL_TRACK} [&>*]:w-[var(--discover-poster,10.5rem)] [&>*]:shrink-0 [&>*]:snap-start`;

export const DISCOVER_SECTION_GRID = {
  posters: POSTER_TRACK,
  cards: "grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]",
};

export function discoverPosterWidth(shelfWidth: number, count: number): number {
  const minimum = shelfWidth < SHELF_NARROW_PX ? POSTER_MIN_NARROW_PX : POSTER_MIN_PX;
  const fitting = Math.floor((shelfWidth + SHELF_GAP_PX) / (minimum + SHELF_GAP_PX));
  const visible = clampNumber(fitting, 1, Math.max(1, count));

  return Math.min(POSTER_MAX_PX, (shelfWidth - SHELF_GAP_PX * (visible - 1)) / visible);
}

type ShelfStyle = CSSProperties & Record<"--discover-poster", string>;

function shelfStyle(width: number | undefined, count: number): ShelfStyle | undefined {
  return width ? { "--discover-poster": `${discoverPosterWidth(width, count)}px` } : undefined;
}

export function DiscoverShelfHeading({ title, controls }: { title: string; controls: ReactNode }) {
  return (
    <div className="flex h-7 items-center gap-2">
      <h3 className="polychat-eyebrow flex-1">{title}</h3>
      {controls}
    </div>
  );
}

export function DiscoverPosterShelf({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const { ref, width } = useElementSize<HTMLElement>();
  const { ref: trackRef, ...scroller } = useHorizontalScroller<HTMLDivElement>();

  return (
    <section
      ref={ref}
      aria-label={title}
      className="flex w-full max-w-full min-w-0 flex-col gap-3"
      style={shelfStyle(width, count)}
    >
      <DiscoverShelfHeading
        title={title}
        controls={<DiscoverCarouselControls scroller={scroller} label={title} />}
      />
      <div className="relative">
        <div ref={trackRef} className={POSTER_TRACK}>
          {children}
        </div>
        <DiscoverCarouselFade scroller={scroller} />
      </div>
    </section>
  );
}

export function DiscoverCardStrip({ title, children }: { title: string; children: ReactNode }) {
  const { ref: trackRef, ...scroller } = useHorizontalScroller<HTMLDivElement>();

  return (
    <section aria-label={title} className="flex max-w-full min-w-0 flex-col gap-3">
      <DiscoverShelfHeading
        title={title}
        controls={<DiscoverCarouselControls scroller={scroller} label={title} />}
      />
      <div className="relative">
        <div
          ref={trackRef}
          className={`-m-1 flex items-stretch gap-3 p-1 ${DISCOVER_CAROUSEL_TRACK} [&>*]:w-[17rem] [&>*]:shrink-0 [&>*]:snap-start`}
        >
          {children}
        </div>
        <DiscoverCarouselFade scroller={scroller} />
      </div>
    </section>
  );
}
