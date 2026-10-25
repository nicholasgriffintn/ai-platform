import {
  Button,
  buttonClassName,
  OptionsMenu,
  OptionsMenuAction,
} from "@ngriffin_uk/polychat-component-ui";
import { getNotebookPath, PERSONAL_SURFACE } from "@ngriffin_uk/polychat-library-react";
import type {
  DiscoverCard,
  DiscoverFeedbackSignal,
  DiscoverFollow,
} from "@ngriffin_uk/polychat-schemas";
import { isHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import {
  ArrowUpRight,
  BellPlus,
  BellRing,
  Bookmark,
  BookOpen,
  Check,
  EyeOff,
  MoreHorizontal,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import { discoverCardLink, hasDiscoverTopic } from "./discover-card-drafts.js";
import { DiscoverHref } from "./DiscoverHref.js";

export interface DiscoverCardToolbarProps {
  card: DiscoverCard;
  signals: readonly DiscoverFeedbackSignal[];
  isSending: boolean;
  follow: DiscoverFollow | undefined;
  isChangingFollow: boolean;
  onFeedback: (card: DiscoverCard, signal: DiscoverFeedbackSignal) => void;
  onToggleFollow: (card: DiscoverCard) => void;
}

function Toggle({
  label,
  active,
  disabled,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "iconActive" : "icon"}
      size="icon"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      icon={icon}
      onClick={onClick}
    />
  );
}

export function DiscoverCardToolbar({
  card,
  signals,
  isSending,
  follow,
  isChangingFollow,
  onFeedback,
  onToggleFollow,
}: DiscoverCardToolbarProps) {
  const navigate = useNavigate();
  const has = (signal: DiscoverFeedbackSignal) => signals.includes(signal);
  const link = discoverCardLink(card);
  const topical = hasDiscoverTopic(card);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {link ? (
        <DiscoverHref
          href={link.href}
          className={buttonClassName({ variant: "secondary", size: "sm", className: "mr-1" })}
        >
          {link.label}
          {isHttpUrl(link.href) ? <ArrowUpRight size={14} aria-hidden /> : null}
        </DiscoverHref>
      ) : null}
      <Toggle
        label={has("saved") ? "Saved" : "Save"}
        active={has("saved")}
        disabled={isSending || has("saved")}
        icon={<Bookmark size={16} />}
        onClick={() => onFeedback(card, "saved")}
      />
      {topical ? (
        <>
          <Toggle
            label={follow ? "Following this topic" : "Follow this topic"}
            active={Boolean(follow)}
            disabled={isChangingFollow}
            icon={follow ? <BellRing size={16} /> : <BellPlus size={16} />}
            onClick={() => onToggleFollow(card)}
          />
          <Toggle
            label="More like this"
            active={has("more")}
            disabled={isSending}
            icon={<ThumbsUp size={16} />}
            onClick={() => onFeedback(card, "more")}
          />
          <Toggle
            label="Less like this"
            active={has("less")}
            disabled={isSending}
            icon={<ThumbsDown size={16} />}
            onClick={() => onFeedback(card, "less")}
          />
          <OptionsMenu
            align="end"
            trigger={
              <Button
                variant="icon"
                size="icon"
                aria-label="More options"
                title="More options"
                icon={<MoreHorizontal size={16} />}
              />
            }
          >
            <OptionsMenuAction disabled={isSending} onSelect={() => onFeedback(card, "hide")}>
              <EyeOff size={14} aria-hidden />
              <span className="flex-1">Hide this topic</span>
              {has("hide") ? <Check size={14} aria-hidden /> : null}
            </OptionsMenuAction>
            {follow ? (
              <OptionsMenuAction
                onSelect={() => void navigate(getNotebookPath(PERSONAL_SURFACE, follow.notebookId))}
              >
                <BookOpen size={14} aria-hidden />
                Open the topic's notebook
              </OptionsMenuAction>
            ) : null}
          </OptionsMenu>
        </>
      ) : null}
    </div>
  );
}
