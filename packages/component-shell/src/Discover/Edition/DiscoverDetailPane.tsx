import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { getNotebookPath, PERSONAL_SURFACE } from "@ngriffin_uk/polychat-library-react";
import type {
  DiscoverCard,
  DiscoverFeedbackSignal,
  DiscoverFollow,
} from "@ngriffin_uk/polychat-schemas";
import {
  ArrowLeft,
  ArrowUpRight,
  BellPlus,
  BellRing,
  Bookmark,
  BookOpen,
  ExternalLink,
  EyeOff,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { SourceListenById } from "../../Files/Viewer/SourceListen.js";
import {
  discoverCardEyebrow,
  discoverCardHeadline,
  hasDiscoverTopic,
} from "./discover-card-drafts.js";
import { DiscoverAskPanel } from "./DiscoverAskPanel.js";
import { DiscoverHref } from "./DiscoverHref.js";
import { DiscoverCover } from "./DiscoverTopicTile.js";

export interface DiscoverDetailPaneProps {
  editionId: string;
  card: DiscoverCard;
  signals: readonly DiscoverFeedbackSignal[];
  isSending: boolean;
  follow: DiscoverFollow | undefined;
  isChangingFollow: boolean;
  onFeedback: (card: DiscoverCard, signal: DiscoverFeedbackSignal) => void;
  onToggleFollow: (card: DiscoverCard) => void;
  onClose: () => void;
}

function FeedbackChip({
  active,
  label,
  icon,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60",
        active
          ? "border-active-work bg-active-work/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-selection hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function CardSummary({ card }: { card: DiscoverCard }) {
  switch (card.kind) {
    case "topic":
      return <p className="text-[0.95rem] leading-relaxed text-foreground">{card.angle}</p>;
    case "read":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-[0.95rem] leading-relaxed text-foreground">{card.summary}</p>
          {card.sourceId ? <SourceListenById sourceId={card.sourceId} /> : null}
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-active-work hover:underline"
          >
            Open on {card.source}
            <ExternalLink size={14} aria-hidden />
          </a>
        </div>
      );
    case "watch":
    case "listen":
    case "inbox":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-[0.95rem] leading-relaxed text-foreground">{card.summary}</p>
          {card.url ? (
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-active-work hover:underline"
            >
              Open on {card.source}
              <ExternalLink size={14} aria-hidden />
            </a>
          ) : null}
        </div>
      );
    case "event":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {card.when}
            {card.where ? ` · ${card.where}` : ""}
          </p>
          <p className="text-[0.95rem] leading-relaxed text-foreground">{card.detail}</p>
          {card.url ? (
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-active-work hover:underline"
            >
              Open it
              <ExternalLink size={14} aria-hidden />
            </a>
          ) : null}
        </div>
      );
    case "action":
      return <p className="text-[0.95rem] leading-relaxed text-foreground">{card.detail}</p>;
    case "check_in":
      return null;
    case "resurface":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-[0.95rem] leading-relaxed text-foreground">{card.detail}</p>
          <DiscoverHref
            href={card.href}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-active-work hover:underline"
          >
            Open it
            <ArrowUpRight size={14} aria-hidden />
          </DiscoverHref>
        </div>
      );
  }
}

export function DiscoverDetailPane({
  editionId,
  card,
  signals,
  isSending,
  follow,
  isChangingFollow,
  onFeedback,
  onToggleFollow,
  onClose,
}: DiscoverDetailPaneProps) {
  const has = (signal: DiscoverFeedbackSignal) => signals.includes(signal);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="relative shrink-0 border-b border-border">
        {card.kind === "topic" && (
          <div className="relative h-28 overflow-hidden xl:h-40">
            <DiscoverCover card={card} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/30 to-transparent" />
          </div>
        )}
        <div
          className={cn(
            "flex flex-col gap-3 px-5 pb-4 sm:px-8",
            card.kind === "topic" ? "relative -mt-14" : "pt-6",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="polychat-eyebrow">{discoverCardEyebrow(card)}</p>
            <Button variant="icon" size="icon" aria-label="Close" onClick={onClose}>
              <span className="lg:hidden">
                <ArrowLeft size={16} aria-hidden />
              </span>
              <span className="hidden lg:inline">
                <X size={16} aria-hidden />
              </span>
            </Button>
          </div>
          <h2 className="max-w-2xl font-display text-2xl leading-tight font-medium tracking-tight text-balance text-foreground xl:text-3xl">
            {discoverCardHeadline(card)}
          </h2>
          <div className="max-w-2xl">
            <CardSummary card={card} />
          </div>
          <p className="text-xs text-muted-foreground">Why this: {card.reason}</p>
          <div className="flex flex-wrap gap-2">
            <FeedbackChip
              active={has("saved")}
              label={has("saved") ? "Saved" : "Save"}
              icon={<Bookmark size={13} aria-hidden />}
              disabled={isSending || has("saved")}
              onClick={() => onFeedback(card, "saved")}
            />
            {hasDiscoverTopic(card) && (
              <>
                <FeedbackChip
                  active={Boolean(follow)}
                  label={follow ? "Following" : "Follow"}
                  icon={
                    follow ? <BellRing size={13} aria-hidden /> : <BellPlus size={13} aria-hidden />
                  }
                  disabled={isChangingFollow}
                  onClick={() => onToggleFollow(card)}
                />
                {follow && (
                  <Link
                    to={getNotebookPath(PERSONAL_SURFACE, follow.notebookId)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-selection hover:text-foreground"
                  >
                    <BookOpen size={13} aria-hidden />
                    Open notebook
                  </Link>
                )}
                <FeedbackChip
                  active={has("more")}
                  label="More like this"
                  icon={<ThumbsUp size={13} aria-hidden />}
                  disabled={isSending}
                  onClick={() => onFeedback(card, "more")}
                />
                <FeedbackChip
                  active={has("less")}
                  label="Less like this"
                  icon={<ThumbsDown size={13} aria-hidden />}
                  disabled={isSending}
                  onClick={() => onFeedback(card, "less")}
                />
                <FeedbackChip
                  active={has("hide")}
                  label="Hide this topic"
                  icon={<EyeOff size={13} aria-hidden />}
                  disabled={isSending}
                  onClick={() => onFeedback(card, "hide")}
                />
              </>
            )}
          </div>
        </div>
      </header>
      <DiscoverAskPanel key={card.id} editionId={editionId} card={card} />
    </div>
  );
}
