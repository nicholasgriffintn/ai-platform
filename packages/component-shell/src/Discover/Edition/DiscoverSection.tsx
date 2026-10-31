import type { CSSProperties, ReactNode } from "react";

export type DiscoverSectionKind = "posters" | "spotlight" | "cards";

const GAP_REM = 0.75;

interface DiscoverSectionLayout {
  minItemRem: number;
  maxItemRem: number | null;
  reservedItems: number;
}

const SECTION_LAYOUT: Record<DiscoverSectionKind, DiscoverSectionLayout> = {
  posters: { minItemRem: 10.5, maxItemRem: null, reservedItems: Number.POSITIVE_INFINITY },
  spotlight: { minItemRem: 20, maxItemRem: 26, reservedItems: 1 },
  cards: { minItemRem: 16, maxItemRem: null, reservedItems: 2 },
};

export const DISCOVER_SECTION_GRID: Record<DiscoverSectionKind, string> = {
  posters: "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]",
  spotlight: "grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(19rem,1fr))]",
  cards: "grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]",
};

function rowWidth(items: number, itemRem: number): string {
  return `${items * itemRem + (items - 1) * GAP_REM}rem`;
}

function sectionStyle(kind: DiscoverSectionKind, count: number): CSSProperties {
  const layout = SECTION_LAYOUT[kind];
  const items = Math.max(count, 1);
  const reserved = Math.min(items, layout.reservedItems);

  return {
    flexBasis: rowWidth(reserved, layout.minItemRem),
    flexGrow: items,
    maxWidth: layout.maxItemRem ? `min(100%, ${rowWidth(items, layout.maxItemRem)})` : undefined,
  };
}

export function DiscoverSectionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-8">{children}</div>;
}

export function DiscoverSection({
  title,
  kind,
  count,
  children,
}: {
  title: string;
  kind: DiscoverSectionKind;
  count: number;
  children: ReactNode;
}) {
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
