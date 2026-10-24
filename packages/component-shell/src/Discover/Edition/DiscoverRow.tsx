import { cn, Pet } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { readUrlHost } from "@ngriffin_uk/polychat-utility-core";
import { CalendarDays, ChevronRight, Headphones, History, Mail, Play, Repeat } from "lucide-react";

type RowCard = Exclude<DiscoverCard, { kind: "topic" }>;

function RowLead({ card }: { card: RowCard }) {
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
        <span className="flex size-9 items-center justify-center rounded-xl bg-selection font-display text-sm font-medium text-foreground uppercase">
          {card.source.slice(0, 1)}
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

function rowText(card: RowCard): { kicker: string; title: string; detail: string | null } {
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
        kicker: `${card.source} · ${readUrlHost(card.url)}`,
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

export function DiscoverRow({
  card,
  selected,
  hidden,
  onSelect,
}: {
  card: RowCard;
  selected: boolean;
  hidden: boolean;
  onSelect: (card: DiscoverCard) => void;
}) {
  const text = rowText(card);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(card)}
      className={cn(
        "group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-selection focus-visible:bg-selection focus-visible:outline-none",
        selected && "bg-selection",
        hidden && "opacity-40",
      )}
    >
      <RowLead card={card} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[0.7rem] text-muted-foreground">{text.kicker}</span>
        <span
          className={cn(
            "text-[0.92rem] leading-snug font-medium text-foreground",
            card.kind === "check_in" && "font-normal italic",
          )}
        >
          {text.title}
        </span>
        {text.detail ? (
          <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {text.detail}
          </span>
        ) : null}
      </span>
      <ChevronRight
        size={16}
        aria-hidden
        className="mt-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}
