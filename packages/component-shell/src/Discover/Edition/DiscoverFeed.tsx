import type { DiscoverCard, DiscoverEdition } from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";

import { DiscoverBrief } from "./DiscoverBrief.js";
import { DiscoverRow } from "./DiscoverRow.js";
import { DiscoverTopicTile } from "./DiscoverTopicTile.js";

type RowCard = Exclude<DiscoverCard, { kind: "topic" }>;

export interface DiscoverFeedProps {
  edition: DiscoverEdition;
  selectedId: string | null;
  isTopicHidden: (card: DiscoverCard) => boolean;
  isFollowing: (card: DiscoverCard) => boolean;
  onSelect: (card: DiscoverCard) => void;
  media: ReactNode;
}

function FeedSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="polychat-eyebrow px-1">{title}</h3>
      {children}
    </section>
  );
}

function RowList({
  cards,
  selectedId,
  isTopicHidden,
  onSelect,
}: {
  cards: readonly RowCard[];
  selectedId: string | null;
  isTopicHidden: (card: DiscoverCard) => boolean;
  onSelect: (card: DiscoverCard) => void;
}) {
  return (
    <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {cards.map((card) => (
        <DiscoverRow
          key={card.id}
          card={card}
          selected={card.id === selectedId}
          hidden={isTopicHidden(card)}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function DiscoverFeed({
  edition,
  selectedId,
  isTopicHidden,
  isFollowing,
  onSelect,
  media,
}: DiscoverFeedProps) {
  const topics = edition.cards.filter(
    (card): card is Extract<DiscoverCard, { kind: "topic" }> => card.kind === "topic",
  );
  const rows = edition.cards.filter((card): card is RowCard => card.kind !== "topic");
  const forYou = rows.filter(
    (card) => card.kind === "action" || card.kind === "check_in" || card.kind === "resurface",
  );
  const comingUp = rows.filter((card) => card.kind === "event");
  const reads = rows.filter((card) => card.kind === "read" || card.kind === "inbox");
  const watching = rows.filter((card) => card.kind === "watch" || card.kind === "listen");

  return (
    <div className="flex flex-col gap-8">
      <DiscoverBrief lines={edition.brief} />
      {media}
      {topics.length > 0 && (
        <FeedSection title="Worth a look">
          <div className="grid grid-cols-2 gap-3">
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
          </div>
        </FeedSection>
      )}
      {forYou.length > 0 && (
        <FeedSection title="For you">
          <RowList
            cards={forYou}
            selectedId={selectedId}
            isTopicHidden={isTopicHidden}
            onSelect={onSelect}
          />
        </FeedSection>
      )}
      {comingUp.length > 0 && (
        <FeedSection title="Coming up">
          <RowList
            cards={comingUp}
            selectedId={selectedId}
            isTopicHidden={isTopicHidden}
            onSelect={onSelect}
          />
        </FeedSection>
      )}
      {reads.length > 0 && (
        <FeedSection title="Reading">
          <RowList
            cards={reads}
            selectedId={selectedId}
            isTopicHidden={isTopicHidden}
            onSelect={onSelect}
          />
        </FeedSection>
      )}
      {watching.length > 0 && (
        <FeedSection title="Watching and listening">
          <RowList
            cards={watching}
            selectedId={selectedId}
            isTopicHidden={isTopicHidden}
            onSelect={onSelect}
          />
        </FeedSection>
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
