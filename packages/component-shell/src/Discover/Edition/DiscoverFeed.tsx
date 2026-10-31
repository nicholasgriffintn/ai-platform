import type { DiscoverCard, DiscoverEdition } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

import {
  DiscoverFeedCard,
  type DiscoverFeedCardSize,
  type DiscoverRowCard,
} from "./DiscoverFeedCard.js";
import {
  DISCOVER_SHELF_VISIBLE,
  DiscoverSection,
  DiscoverSectionRow,
  type DiscoverSectionKind,
} from "./DiscoverSection.js";
import { DiscoverStoryTile, type DiscoverStoryCard } from "./DiscoverStoryTile.js";
import { DiscoverTopicTile } from "./DiscoverTopicTile.js";
import { groupDiscoverCards } from "./item/discover-items.js";

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
}

function CardSection({
  title,
  cards,
  kind = "cards",
  size = "regular",
  selectedId,
  isTopicHidden,
  onSelect,
}: {
  title: string;
  cards: readonly DiscoverRowCard[];
  kind?: DiscoverSectionKind;
  size?: DiscoverFeedCardSize;
  selectedId: string | null;
  isTopicHidden: (card: DiscoverCard) => boolean;
  onSelect: (card: DiscoverCard) => void;
}) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <DiscoverSection title={title} kind={kind} count={cards.length}>
      {cards.map((card) => (
        <DiscoverFeedCard
          key={card.id}
          card={card}
          selected={card.id === selectedId}
          hidden={isTopicHidden(card)}
          size={size}
          onSelect={onSelect}
        />
      ))}
    </DiscoverSection>
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
}: DiscoverFeedProps) {
  const { topics, stories, forYou, comingUp, reads, watching } = groupDiscoverCards(edition.cards);
  const rows = [...forYou, ...comingUp, ...reads, ...watching];
  const posterCount = topics.length + stories.length;
  const cardProps = { selectedId, isTopicHidden, onSelect };

  return (
    <div className="flex flex-col gap-10">
      {mediaCount > 0 || posterCount > 0 ? (
        <DiscoverSectionRow
          posters={[
            Math.min(mediaCount, DISCOVER_SHELF_VISIBLE.watch),
            Math.min(posterCount, DISCOVER_SHELF_VISIBLE.worth),
          ]}
        >
          {media}
          {posterCount > 0 && (
            <DiscoverSection
              title="Worth a look"
              kind="posters"
              count={posterCount}
              maxVisible={DISCOVER_SHELF_VISIBLE.worth}
            >
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
            </DiscoverSection>
          )}
        </DiscoverSectionRow>
      ) : null}
      {rows.length > 0 && (
        <DiscoverSectionRow>
          <CardSection
            title="For you"
            cards={forYou}
            kind="spotlight"
            size="large"
            {...cardProps}
          />
          <CardSection title="Coming up" cards={comingUp} {...cardProps} />
          <CardSection title="Reading" cards={reads} {...cardProps} />
          <CardSection title="Watching and listening" cards={watching} {...cardProps} />
        </DiscoverSectionRow>
      )}
      {edition.interests.length > 0 && (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
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
  );
}
