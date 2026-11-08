import { Favicon } from "@ngriffin_uk/polychat-component-content";
import { cn, Pet } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { formatCount, readUrlHost } from "@ngriffin_uk/polychat-utility-core";
import { CalendarDays, ChevronRight, Headphones, History, Mail, Play, Repeat } from "lucide-react";
import { memo } from "react";

import { discoverCardBody } from "./discover-card-drafts.js";
import { DiscoverArticleImage } from "./DiscoverArticleImage.js";

export type DiscoverRowCard = Exclude<DiscoverCard, { kind: "topic" | "wind_down" }>;

function describeReadSource(source: string, url: string): string {
  const host = readUrlHost(url);
  const sameHost =
    source.toLowerCase().replace(/^www\./u, "") === host.toLowerCase().replace(/^www\./u, "");

  return sameHost || !host ? source : `${source} · ${host}`;
}

function CardLead({ card }: { card: DiscoverRowCard }) {
  switch (card.kind) {
    case "action":
      return (
        <span className="flex size-9 items-center justify-center rounded-xl bg-human-action/12 text-human-action">
          <Repeat size={16} aria-hidden />
        </span>
      );
    case "check_in":
      return (
        <span className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-selection">
          <Pet size={30} placement="top" href={null} showNudges={false} label="Poly" />
        </span>
      );
    case "read":
      return (
        <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-selection font-display text-sm font-medium text-foreground uppercase">
          {card.source.slice(0, 1)}
          <Favicon url={card.url} className="absolute inset-0 size-9 rounded-xl bg-selection p-2" />
        </span>
      );
    case "resurface":
      return (
        <span className="flex size-9 items-center justify-center rounded-xl bg-active-work/12 text-active-work">
          <History size={16} aria-hidden />
        </span>
      );
    case "watch":
      return (
        <span className="flex size-9 items-center justify-center rounded-xl bg-selection text-foreground">
          <Play size={16} aria-hidden />
        </span>
      );
    case "listen":
      return (
        <span className="flex size-9 items-center justify-center rounded-xl bg-selection text-foreground">
          <Headphones size={16} aria-hidden />
        </span>
      );
    case "event":
      return (
        <span className="flex size-9 items-center justify-center rounded-xl bg-selection text-foreground">
          <CalendarDays size={16} aria-hidden />
        </span>
      );
    case "inbox":
      return (
        <span className="flex size-9 items-center justify-center rounded-xl bg-selection text-foreground">
          <Mail size={16} aria-hidden />
        </span>
      );
  }
}

function cardText(card: DiscoverRowCard): { kicker: string; title: string; detail: string | null } {
  switch (card.kind) {
    case "action":
      return {
        kicker: card.when ? `Worth doing · ${card.when}` : "Worth doing",
        title: card.title,
        detail: card.detail,
      };
    case "check_in":
      return { kicker: "Poly asks", title: card.question, detail: null };
    case "read":
      return {
        kicker: [
          describeReadSource(card.source, card.url),
          card.outletCount && card.outletCount > 1
            ? formatCount(card.outletCount, "outlet")
            : card.alsoIn?.length
              ? `+${card.alsoIn.length} more`
              : "",
        ]
          .filter(Boolean)
          .join(" · "),
        title: card.title,
        detail: discoverCardBody(card),
      };
    case "resurface":
      return { kicker: "From before", title: card.title, detail: card.detail };
    case "watch":
      return { kicker: `Watch · ${card.source}`, title: card.title, detail: card.summary };
    case "listen":
      return { kicker: `Listen · ${card.source}`, title: card.title, detail: card.summary };
    case "event":
      return {
        kicker: card.where ? `${card.when} · ${card.where}` : card.when,
        title: card.title,
        detail: card.detail,
      };
    case "inbox":
      return { kicker: `From ${card.source}`, title: card.title, detail: card.summary };
  }
}

export const DiscoverFeedCard = memo(function DiscoverFeedCard({
  card,
  selected,
  hidden,
  compact = false,
  onSelect,
}: {
  card: DiscoverRowCard;
  selected: boolean;
  hidden: boolean;
  compact?: boolean;
  onSelect: (card: DiscoverCard) => void;
}) {
  const text = cardText(card);
  const isQuestion = card.kind === "check_in";
  const chevron = (
    <ChevronRight
      size={16}
      aria-hidden
      className="mt-2.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    />
  );

  return (
    <button
      type="button"
      aria-pressed={selected}
      data-discover-item={`card:${card.id}`}
      onClick={() => onSelect(card)}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface text-left ring-offset-2 ring-offset-canvas transition hover:border-border-strong hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none active:scale-[.99] motion-reduce:active:scale-100",
        "p-4",
        selected && "border-border-strong bg-surface-elevated ring-2 ring-active-work",
        hidden && "opacity-40",
      )}
    >
      {compact ? null : <DiscoverArticleImage card={card} />}
      {isQuestion ? (
        <>
          <span className="flex items-center gap-3">
            <CardLead card={card} />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {text.kicker}
            </span>
            {chevron}
          </span>
          <span className="font-display text-xl leading-snug text-foreground italic">
            {text.title}
          </span>
        </>
      ) : (
        <span className="flex items-start gap-3">
          {compact ? (
            <DiscoverArticleImage
              card={card}
              className="aspect-square size-12 shrink-0"
              fallback={<CardLead card={card} />}
            />
          ) : (
            <CardLead card={card} />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-xs text-muted-foreground">{text.kicker}</span>
            <span className="line-clamp-2 text-[0.95rem] leading-snug font-medium text-foreground">
              {text.title}
            </span>
            {text.detail ? (
              <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {text.detail}
              </span>
            ) : null}
          </span>
          {chevron}
        </span>
      )}
    </button>
  );
});
