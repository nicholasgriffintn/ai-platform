import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { clampNumber } from "@ngriffin_uk/polychat-utility-core";
import { useElementSize } from "@ngriffin_uk/polychat-utility-react";

import { discoverCardBody } from "./discover-card-drafts.js";
import { DiscoverFeedCard, type DiscoverRowCard } from "./DiscoverFeedCard.js";

const COLUMN_MIN_PX = 272;
const COLUMN_GAP_PX = 12;
const COLUMN_LIMIT = 5;
const CARD_TEXT_PX = 104;
const CARD_DETAIL_PX = 48;
const IMAGE_RATIO = 9 / 16;

export function countDiscoverColumns(width: number): number {
  return clampNumber(
    Math.floor((width + COLUMN_GAP_PX) / (COLUMN_MIN_PX + COLUMN_GAP_PX)),
    1,
    COLUMN_LIMIT,
  );
}

function estimateCardHeight(card: DiscoverCard, columnWidth: number): number {
  const image = "imageUrl" in card && card.imageUrl ? columnWidth * IMAGE_RATIO : 0;

  return CARD_TEXT_PX + (discoverCardBody(card) ? CARD_DETAIL_PX : 0) + image;
}

export function distributeDiscoverCards<T extends DiscoverCard>(
  cards: readonly T[],
  columnCount: number,
  columnWidth: number,
): T[][] {
  const columns: Array<{ height: number; cards: T[] }> = Array.from(
    { length: columnCount },
    () => ({ height: 0, cards: [] }),
  );

  for (const card of cards) {
    const shortest = columns.reduce((best, column) =>
      column.height < best.height ? column : best,
    );

    shortest.cards.push(card);
    shortest.height += estimateCardHeight(card, columnWidth) + COLUMN_GAP_PX;
  }

  return columns.map((column) => column.cards);
}

export function DiscoverMasonry({
  title,
  cards,
  selectedId,
  isTopicHidden,
  onSelect,
}: {
  title: string;
  cards: readonly DiscoverRowCard[];
  selectedId: string | null;
  isTopicHidden: (card: DiscoverCard) => boolean;
  onSelect: (card: DiscoverCard) => void;
}) {
  const { ref, width = 0 } = useElementSize<HTMLDivElement>();
  const columnCount = countDiscoverColumns(width);
  const columnWidth = (width - COLUMN_GAP_PX * (columnCount - 1)) / columnCount;

  if (cards.length === 0) {
    return null;
  }

  return (
    <section aria-label={title} className="flex max-w-full min-w-0 flex-col gap-3">
      <h3 className="polychat-eyebrow">{title}</h3>
      <div ref={ref} className="flex items-start gap-3">
        {distributeDiscoverCards(cards, columnCount, columnWidth).map((column, index) => (
          <div key={index} className="flex min-w-0 flex-1 flex-col gap-3">
            {column.map((card) => (
              <DiscoverFeedCard
                key={card.id}
                card={card}
                selected={card.id === selectedId}
                hidden={isTopicHidden(card)}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
