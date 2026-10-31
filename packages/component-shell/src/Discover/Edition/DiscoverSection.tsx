import { cn } from "@ngriffin_uk/polychat-component-ui";
import { clampNumber } from "@ngriffin_uk/polychat-utility-core";
import { useHorizontalScroller } from "@ngriffin_uk/polychat-utility-react";
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

import {
  DISCOVER_CAROUSEL_TRACK,
  DiscoverCarouselControls,
  DiscoverCarouselFade,
} from "./DiscoverCarousel.js";

export type DiscoverSectionKind = "posters" | "spotlight" | "cards";

const GAP_REM = 0.75;
const REM_PX = 16;
const POSTER_GAP_PX = GAP_REM * REM_PX;
const SECTION_GAP_PX = 2 * REM_PX;
const POSTER_MIN_PX = 10.5 * REM_PX;
const POSTER_MAX_PX = 20 * REM_PX;

type CardSectionKind = Exclude<DiscoverSectionKind, "posters">;

interface DiscoverSectionLayout {
  minItemRem: number;
  maxItemRem: number | null;
  reservedItems: number;
}

const SECTION_LAYOUT: Record<CardSectionKind, DiscoverSectionLayout> = {
  spotlight: { minItemRem: 20, maxItemRem: 26, reservedItems: 1 },
  cards: { minItemRem: 16, maxItemRem: null, reservedItems: 2 },
};

export const DISCOVER_SHELF_VISIBLE = { watch: 4, worth: 3 };

const POSTER_TRACK = `-m-1 flex scroll-px-1 gap-3 p-1 ${DISCOVER_CAROUSEL_TRACK} [&>*]:w-[calc((100%-0.75rem)/2)] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[var(--discover-poster,10.5rem)]`;

export const DISCOVER_SECTION_GRID: Record<DiscoverSectionKind, string> = {
  posters: POSTER_TRACK,
  spotlight: "grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(19rem,1fr))]",
  cards: "grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]",
};

const POSTER_SECTION_CLASS =
  "sm:w-[calc(var(--poster-count)*var(--discover-poster,10.5rem)+(var(--poster-count)-1)*0.75rem)]";

export function discoverPosterWidth(rowWidth: number, sections: readonly number[]): number {
  const counts = sections.filter((count) => count > 0);
  const total = counts.reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return POSTER_MIN_PX;
  }

  const sharedRow =
    (rowWidth - SECTION_GAP_PX * (counts.length - 1) - POSTER_GAP_PX * (total - counts.length)) /
    total;

  if (sharedRow >= POSTER_MIN_PX) {
    return Math.min(POSTER_MAX_PX, sharedRow);
  }

  const fitting = Math.max(
    1,
    Math.floor((rowWidth + POSTER_GAP_PX) / (POSTER_MIN_PX + POSTER_GAP_PX)),
  );
  const visible = Math.min(Math.max(...counts), fitting);

  return clampNumber(
    (rowWidth - POSTER_GAP_PX * (visible - 1)) / visible,
    POSTER_MIN_PX,
    POSTER_MAX_PX,
  );
}

function rowWidth(items: number, itemRem: number): string {
  return `${items * itemRem + (items - 1) * GAP_REM}rem`;
}

function sectionStyle(kind: CardSectionKind, count: number): CSSProperties {
  const layout = SECTION_LAYOUT[kind];
  const items = Math.max(count, 1);
  const reserved = Math.min(items, layout.reservedItems);

  return {
    flexBasis: rowWidth(reserved, layout.minItemRem),
    flexGrow: items,
    maxWidth: layout.maxItemRem ? `min(100%, ${rowWidth(items, layout.maxItemRem)})` : undefined,
  };
}

export function DiscoverSectionRow({
  posters,
  children,
}: {
  posters?: readonly number[];
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;

    if (!row || !posters) {
      return undefined;
    }

    const apply = () =>
      row.style.setProperty(
        "--discover-poster",
        `${discoverPosterWidth(row.clientWidth, posters)}px`,
      );
    const observer = new ResizeObserver(apply);

    apply();
    observer.observe(row);

    return () => observer.disconnect();
  });

  return (
    <div ref={rowRef} className={cn("flex flex-wrap gap-8", posters && "justify-between")}>
      {children}
    </div>
  );
}

function DiscoverPosterSection({
  title,
  count,
  maxVisible,
  children,
}: {
  title: string;
  count: number;
  maxVisible: number;
  children: ReactNode;
}) {
  const { ref: trackRef, ...scroller } = useHorizontalScroller<HTMLDivElement>();
  const style: CSSProperties & Record<"--poster-count", number> = {
    "--poster-count": clampNumber(count, 1, maxVisible),
  };

  return (
    <section
      aria-label={title}
      className={`flex w-full max-w-full min-w-0 flex-col gap-3 ${POSTER_SECTION_CLASS}`}
      style={style}
    >
      <div className="flex h-7 items-center gap-2 px-1">
        <h3 className="polychat-eyebrow flex-1">{title}</h3>
        <DiscoverCarouselControls scroller={scroller} label={title} />
      </div>
      <div className="relative">
        <div ref={trackRef} className={POSTER_TRACK}>
          {children}
        </div>
        <DiscoverCarouselFade scroller={scroller} />
      </div>
    </section>
  );
}

export function DiscoverSection({
  title,
  kind,
  count,
  maxVisible = count,
  children,
}: {
  title: string;
  kind: DiscoverSectionKind;
  count: number;
  maxVisible?: number;
  children: ReactNode;
}) {
  if (kind === "posters") {
    return (
      <DiscoverPosterSection title={title} count={count} maxVisible={maxVisible}>
        {children}
      </DiscoverPosterSection>
    );
  }

  return (
    <section
      aria-label={title}
      className="flex max-w-full min-w-0 flex-col gap-3"
      style={sectionStyle(kind, count)}
    >
      <h3 className="polychat-eyebrow px-1">{title}</h3>
      <div className={DISCOVER_SECTION_GRID[kind]}>{children}</div>
    </section>
  );
}
