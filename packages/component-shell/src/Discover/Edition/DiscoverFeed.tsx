import type { DiscoverCard, DiscoverEdition } from "@ngriffin_uk/polychat-schemas";
import { useElementSize, useStableCallback } from "@ngriffin_uk/polychat-utility-react";
import type { ReactNode } from "react";

import { DiscoverFeedCard, type DiscoverRowCard } from "./DiscoverFeedCard.js";
import { DiscoverMasonry } from "./DiscoverMasonry.js";
import { DiscoverCardStrip, DiscoverPosterShelf } from "./DiscoverSection.js";
import { DiscoverStoryTile, type DiscoverStoryCard } from "./DiscoverStoryTile.js";
import { DiscoverTopicTile } from "./DiscoverTopicTile.js";
import { groupDiscoverCards } from "./item/discover-items.js";

const RAIL_MIN_FEED_PX = 960;
const RAIL_TOP_GAP = "1rem";
const RAIL_VIEWPORT_CLEARANCE = "13rem";

export interface DiscoverFeedProps {
  edition: DiscoverEdition;
  selectedId: string | null;
  isTopicHidden: (card: DiscoverCard) => boolean;
  isFollowing: (card: DiscoverCard) => boolean;
  onSelect: (card: DiscoverCard) => void;
  startingStoryId: string | null;
  failedStoryId: string | null;
  openStoryId: string | null;
  onStartStory: (card: DiscoverStoryCard) => void;
  media: ReactNode;
  mediaCount: number;
  newCardIds?: ReadonlySet<string> | null;
}

interface CardProps {
  selectedId: string | null;
  isTopicHidden: (card: DiscoverCard) => boolean;
  onSelect: (card: DiscoverCard) => void;
}

export function discoverRailTop(railHeight: number): string {
  return `min(${RAIL_TOP_GAP}, calc(100dvh - ${RAIL_VIEWPORT_CLEARANCE} - ${railHeight}px))`;
}

function DiscoverRail({
  comingUp,
  forYou,
  watching,
  ...cardProps
}: CardProps & {
  comingUp: readonly DiscoverRowCard[];
  forYou: readonly DiscoverRowCard[];
  watching: readonly DiscoverRowCard[];
}) {
  const { ref, height = 0 } = useElementSize<HTMLElement>();

  return (
    <aside
      ref={ref}
      aria-label="Also for you"
      className="sticky flex w-[clamp(18rem,26%,24rem)] shrink-0 flex-col gap-6"
      style={{ top: discoverRailTop(height) }}
    >
      <RailGroup title="Coming up" cards={comingUp} {...cardProps} />
      <RailGroup title="For you" cards={forYou} {...cardProps} />
      <RailGroup title="Watching and listening" cards={watching} {...cardProps} />
    </aside>
  );
}

function RailCards({
  cards,
  selectedId,
  isTopicHidden,
  onSelect,
}: CardProps & { cards: readonly DiscoverRowCard[] }) {
  return cards.map((card) => (
    <DiscoverFeedCard
      key={card.id}
      card={card}
      selected={card.id === selectedId}
      hidden={isTopicHidden(card)}
      compact
      onSelect={onSelect}
    />
  ));
}

function RailGroup({
  title,
  cards,
  ...cardProps
}: CardProps & { title: string; cards: readonly DiscoverRowCard[] }) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h3 className="polychat-eyebrow">{title}</h3>
      <div className="flex flex-col gap-3">
        <RailCards cards={cards} {...cardProps} />
      </div>
    </section>
  );
}

export function DiscoverFeed({
  edition,
  selectedId,
  isTopicHidden,
  isFollowing,
  onSelect,
  startingStoryId,
  failedStoryId,
  openStoryId,
  onStartStory,
  media,
  mediaCount,
  newCardIds = null,
}: DiscoverFeedProps) {
  const { ref, width = 0 } = useElementSize<HTMLDivElement>();
  const { topics, stories, forYou, comingUp, reads, watching } = groupDiscoverCards(edition.cards);
  const railCards = [...comingUp, ...forYou, ...watching];
  const railBeside = railCards.length > 0 && width >= RAIL_MIN_FEED_PX;
  const posterCount = topics.length + stories.length;
  const shelfCount = mediaCount + posterCount;
  const selectCard = useStableCallback(onSelect);
  const cardProps = { selectedId, isTopicHidden, onSelect: selectCard };
  const newReads = newCardIds ? reads.filter((card) => newCardIds.has(card.id)) : [];
  const earlierReads = newCardIds ? reads.filter((card) => !newCardIds.has(card.id)) : reads;
  const earlierTitle = !newCardIds
    ? "Reading"
    : newReads.length > 0
      ? "Earlier"
      : "You're caught up · Earlier";

  return (
    <div className="flex flex-col gap-10">
      {shelfCount > 0 && (
        <DiscoverPosterShelf
          title={posterCount > 0 ? "For today" : "Watch and listen"}
          count={shelfCount}
        >
          {media}
          {topics.map((card) => (
            <DiscoverTopicTile
              key={card.id}
              card={card}
              selected={card.id === selectedId}
              hidden={isTopicHidden(card)}
              following={isFollowing(card)}
              onSelect={onSelect}
            />
          ))}
          {stories.map((card) => (
            <DiscoverStoryTile
              key={card.id}
              card={card}
              starting={card.id === startingStoryId}
              failed={card.id === failedStoryId}
              selected={card.id === openStoryId}
              onStart={onStartStory}
            />
          ))}
        </DiscoverPosterShelf>
      )}
      <div ref={ref} className="flex items-start gap-8">
        {railBeside && (
          <DiscoverRail comingUp={comingUp} forYou={forYou} watching={watching} {...cardProps} />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-10">
          {railCards.length > 0 && !railBeside && (
            <DiscoverCardStrip title="Also for you">
              <RailCards cards={railCards} {...cardProps} />
            </DiscoverCardStrip>
          )}
          <DiscoverMasonry title="New since you last looked" cards={newReads} {...cardProps} />
          <DiscoverMasonry title={earlierTitle} cards={earlierReads} {...cardProps} />
          {edition.interests.length > 0 && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Built around{" "}
              {edition.interests.map((interest, index) => (
                <span key={interest.topic} title={interest.reason}>
                  {index > 0 && " · "}
                  {interest.topic}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
