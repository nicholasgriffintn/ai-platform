import { Favicon } from "@ngriffin_uk/polychat-component-content";
import { cn, Pet } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { readUrlHost } from "@ngriffin_uk/polychat-utility-core";
import { CalendarDays, ChevronRight, Headphones, History, Mail, Play, Repeat } from "lucide-react";

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
        kicker: describeReadSource(card.source, card.url),
        title: card.title,
        detail: card.summary,
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

export type DiscoverFeedCardSize = "regular" | "large";

export function DiscoverFeedCard({
  card,
  selected,
  hidden,
  size = "regular",
  onSelect,
}: {
  card: DiscoverRowCard;
  selected: boolean;
  hidden: boolean;
  size?: DiscoverFeedCardSize;
  onSelect: (card: DiscoverCard) => void;
}) {
  const text = cardText(card);
  const isQuestion = card.kind === "check_in";
  const isLarge = size === "large";
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
      onClick={() => onSelect(card)}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface text-left transition-colors hover:border-border-strong hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-active-work focus-visible:outline-none",
        isLarge ? "gap-4 p-5" : "p-4",
        selected && "border-border-strong bg-surface-elevated",
        hidden && "opacity-40",
      )}
    >
      {isQuestion ? (
        <>
          <span className="flex items-center gap-3">
            <CardLead card={card} />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {text.kicker}
            </span>
            {chevron}
          </span>
          <span
            className={cn(
              "font-display leading-snug text-foreground italic",
              isLarge ? "text-2xl" : "text-xl",
            )}
          >
            {text.title}
          </span>
        </>
      ) : (
        <span className="flex items-start gap-3">
          <CardLead card={card} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-xs text-muted-foreground">{text.kicker}</span>
            <span
              className={cn(
                "line-clamp-2 leading-snug font-medium text-foreground",
                isLarge ? "text-lg" : "text-[0.95rem]",
              )}
            >
              {text.title}
            </span>
            {text.detail ? (
              <span
                className={cn(
                  "leading-relaxed text-muted-foreground",
                  isLarge ? "line-clamp-3 text-[0.95rem]" : "line-clamp-2 text-sm",
                )}
              >
                {text.detail}
              </span>
            ) : null}
          </span>
          {chevron}
        </span>
      )}
    </button>
  );
}
