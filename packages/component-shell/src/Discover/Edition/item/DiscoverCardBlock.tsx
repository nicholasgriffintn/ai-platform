import { buttonClassName, Pet } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { isHttpUrl, normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { SourceListenById } from "../../../Files/Viewer/SourceListen.js";
import {
  cardTopic,
  countTopicArticles,
  discoverCardBody,
  discoverCardEyebrow,
  discoverCardHeadline,
  discoverCardLink,
} from "../discover-card-drafts.js";
import { DiscoverCoverageCard } from "../DiscoverCoverage.js";
import { DiscoverFramingCard } from "../DiscoverFraming.js";
import { DiscoverHref } from "../DiscoverHref.js";
import { DiscoverCover } from "../DiscoverTopicTile.js";
import { discoverItemKind } from "./discover-item-kind.js";
import { DiscoverFollowButton, type DiscoverCardFeedback } from "./DiscoverCardActions.js";
import { DiscoverItemThumb } from "./DiscoverItemThumb.js";

const RELATED_LIMIT = 2;

type ReadingCard = Extract<DiscoverCard, { kind: "read" | "inbox" }>;

function isReading(card: DiscoverCard): card is ReadingCard {
  return card.kind === "read" || card.kind === "inbox";
}

function relatedReading(card: ReadingCard, cards: readonly DiscoverCard[]): ReadingCard[] {
  const topic = normaliseComparableText(cardTopic(card));
  const others = cards.filter(
    (candidate): candidate is ReadingCard => isReading(candidate) && candidate.id !== card.id,
  );
  const sameTopic = others.filter(
    (candidate) => normaliseComparableText(cardTopic(candidate)) === topic,
  );

  return [...sameTopic, ...others.filter((candidate) => !sameTopic.includes(candidate))].slice(
    0,
    RELATED_LIMIT,
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section data-stagger className="flex flex-col gap-2">
      <h3 className="polychat-eyebrow">{title}</h3>
      {children}
    </section>
  );
}

function Headline({ card }: { card: DiscoverCard }) {
  return (
    <h2
      className={
        card.kind === "check_in"
          ? "font-display text-[1.75rem] leading-[1.2] text-balance text-foreground italic xl:text-3xl"
          : "font-display text-[1.75rem] leading-[1.15] font-medium tracking-tight text-balance text-foreground xl:text-3xl"
      }
    >
      {discoverCardHeadline(card)}
    </h2>
  );
}

function CardLead({ card, following }: { card: DiscoverCard; following: boolean }) {
  if (card.kind === "topic") {
    return (
      <>
        <div
          data-discover-art-target
          className="relative h-60 overflow-hidden rounded-2xl border border-border"
        >
          <DiscoverCover card={card} className="absolute inset-0" />
          {following ? (
            <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
              Following
            </span>
          ) : null}
        </div>
        <div data-stagger className="flex flex-col gap-1.5">
          <p className="polychat-eyebrow">{discoverCardEyebrow(card)}</p>
          <Headline card={card} />
        </div>
      </>
    );
  }

  if (card.kind === "check_in") {
    return (
      <div data-stagger className="flex flex-col gap-3">
        <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-selection">
          <Pet size={34} placement="top" href={null} showNudges={false} label="Poly" />
        </span>
        <Headline card={card} />
      </div>
    );
  }

  if (isReading(card)) {
    return (
      <div data-stagger className="flex flex-col gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <DiscoverItemThumb art={{ type: "card", card }} className="size-8 rounded-lg text-sm" />
          <span className="truncate text-sm text-muted-foreground">
            {discoverCardEyebrow(card)}
          </span>
        </span>
        <Headline card={card} />
      </div>
    );
  }

  const Icon = discoverItemKind({ type: "card", card }).icon;

  return (
    <div data-stagger className="flex flex-col gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-active-work">
        <Icon size={17} aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="polychat-eyebrow">{discoverCardEyebrow(card)}</p>
        <Headline card={card} />
      </div>
    </div>
  );
}

export function DiscoverCardBlock({
  editionId,
  card,
  cards,
  feedback,
  onSelect,
}: {
  editionId: string;
  card: DiscoverCard;
  cards: readonly DiscoverCard[];
  feedback: DiscoverCardFeedback;
  onSelect: (card: DiscoverCard) => void;
}) {
  const body = discoverCardBody(card);
  const link = discoverCardLink(card);
  const sourceId = card.kind === "read" ? card.sourceId : undefined;
  const related = isReading(card) ? relatedReading(card, cards) : [];
  const summarised = isReading(card) || card.kind === "watch" || card.kind === "listen";

  return (
    <div className="flex flex-col gap-5">
      <CardLead card={card} following={Boolean(feedback.follow)} />
      {body && summarised ? (
        <Section title="Summary">
          <p className="text-[0.95rem] leading-relaxed text-pretty text-foreground">{body}</p>
        </Section>
      ) : body ? (
        <p data-stagger className="text-[0.95rem] leading-relaxed text-pretty text-foreground">
          {body}
        </p>
      ) : null}
      <p data-stagger className="text-sm leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Why this: </span>
        {card.reason}
      </p>
      <div data-stagger className="flex flex-wrap items-center gap-2">
        {link ? (
          <DiscoverHref
            href={link.href}
            className={buttonClassName({ variant: "primary", size: "sm" })}
          >
            {link.label}
            {isHttpUrl(link.href) ? <ArrowUpRight size={14} aria-hidden /> : null}
          </DiscoverHref>
        ) : null}
        <DiscoverFollowButton card={card} feedback={feedback} />
      </div>
      {sourceId ? (
        <div data-stagger className="flex flex-col gap-3">
          <SourceListenById sourceId={sourceId} />
          <DiscoverFramingCard editionId={editionId} cardId={card.id} sourceId={sourceId} />
        </div>
      ) : null}
      {card.kind === "topic" ? (
        <div data-stagger>
          <DiscoverCoverageCard
            editionId={editionId}
            cardId={card.id}
            coverageSourceId={card.coverageSourceId}
            articleCount={countTopicArticles(cards, card.topic)}
          />
        </div>
      ) : null}
      {related.length > 0 ? (
        <Section title="Also in your reading">
          <ul className="flex flex-col border-t border-border">
            {related.map((entry) => (
              <li key={entry.id} className="border-b border-border">
                <button
                  type="button"
                  onClick={() => onSelect(entry)}
                  className="flex w-full flex-col gap-0.5 rounded-md px-1 py-2.5 text-left transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none"
                >
                  <span className="truncate text-xs text-muted-foreground">
                    {discoverCardEyebrow(entry)}
                  </span>
                  <span className="truncate text-sm text-foreground">{entry.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
