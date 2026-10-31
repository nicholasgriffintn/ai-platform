import type { DiscoverCard, DiscoverEdition } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

import {
  DiscoverFeedCard,
  type DiscoverFeedCardSize,
  type DiscoverRowCard,
} from "./DiscoverFeedCard.js";
import {
  DiscoverSection,
  DiscoverSectionRow,
  type DiscoverSectionKind,
} from "./DiscoverSection.js";
import { DiscoverStoryTile, type DiscoverStoryCard } from "./DiscoverStoryTile.js";
import { DiscoverTopicTile } from "./DiscoverTopicTile.js";

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
}: DiscoverFeedProps) {
  const topics = edition.cards.filter(
    (card): card is Extract<DiscoverCard, { kind: "topic" }> => card.kind === "topic",
  );
  const stories = edition.cards.filter(
    (card): card is DiscoverStoryCard => card.kind === "wind_down",
  );
  const rows = edition.cards.filter(
    (card): card is DiscoverRowCard => card.kind !== "topic" && card.kind !== "wind_down",
  );
  const forYou = rows.filter(
    (card) => card.kind === "action" || card.kind === "check_in" || card.kind === "resurface",
  );
  const comingUp = rows.filter((card) => card.kind === "event");
  const reads = rows.filter((card) => card.kind === "read" || card.kind === "inbox");
  const watching = rows.filter((card) => card.kind === "watch" || card.kind === "listen");
  const posterCount = topics.length + stories.length;
  const cardProps = { selectedId, isTopicHidden, onSelect };

  return (
    <div className="flex flex-col gap-10">
      {media || posterCount > 0 ? (
        <DiscoverSectionRow>
          {media}
          {posterCount > 0 && (
            <DiscoverSection title="Worth a look" kind="posters" count={posterCount}>
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
