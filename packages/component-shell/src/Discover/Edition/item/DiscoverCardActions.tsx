import { Button, OptionsMenu, OptionsMenuAction } from "@ngriffin_uk/polychat-component-ui";
import { getNotebookPath, PERSONAL_SURFACE } from "@ngriffin_uk/polychat-library-react";
import type {
  DiscoverCard,
  DiscoverFeedbackSignal,
  DiscoverFollow,
} from "@ngriffin_uk/polychat-schemas";
import {
  BellPlus,
  Bookmark,
  BookOpen,
  Check,
  EyeOff,
  MoreHorizontal,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useNavigate } from "react-router";

import { cardTopic, hasDiscoverTopic } from "../discover-card-drafts.js";

export interface DiscoverCardTarget {
  card: DiscoverCard;
  feedback: DiscoverCardFeedback;
}

export interface DiscoverCardFeedback {
  signals: readonly DiscoverFeedbackSignal[];
  isSending: boolean;
  follow: DiscoverFollow | undefined;
  isChangingFollow: boolean;
  onFeedback: (card: DiscoverCard, signal: DiscoverFeedbackSignal) => void;
  onToggleFollow: (card: DiscoverCard) => void;
}

export function DiscoverSaveButton({
  card,
  feedback,
}: {
  card: DiscoverCard;
  feedback: DiscoverCardFeedback;
}) {
  const saved = feedback.signals.includes("saved");

  return (
    <Button
      variant={saved ? "iconActive" : "icon"}
      size="sm"
      aria-label={saved ? "Saved" : "Save"}
      aria-pressed={saved}
      title={saved ? "Saved" : "Save"}
      disabled={feedback.isSending || saved}
      icon={<Bookmark size={15} fill={saved ? "currentColor" : "none"} aria-hidden />}
      onClick={() => feedback.onFeedback(card, "saved")}
    />
  );
}

export function DiscoverCardMenu({
  card,
  feedback,
}: {
  card: DiscoverCard;
  feedback: DiscoverCardFeedback;
}) {
  const navigate = useNavigate();
  const has = (signal: DiscoverFeedbackSignal) => feedback.signals.includes(signal);

  const option = (signal: DiscoverFeedbackSignal) => ({
    disabled: feedback.isSending,
    onSelect: () => feedback.onFeedback(card, signal),
  });

  return (
    <OptionsMenu
      align="end"
      trigger={
        <Button
          variant="icon"
          size="sm"
          aria-label="More options"
          title="More options"
          icon={<MoreHorizontal size={15} aria-hidden />}
        />
      }
    >
      <OptionsMenuAction {...option("more")}>
        <ThumbsUp size={14} aria-hidden />
        <span className="flex-1">More like this</span>
        {has("more") ? <Check size={14} aria-hidden /> : null}
      </OptionsMenuAction>
      <OptionsMenuAction {...option("less")}>
        <ThumbsDown size={14} aria-hidden />
        <span className="flex-1">Less like this</span>
        {has("less") ? <Check size={14} aria-hidden /> : null}
      </OptionsMenuAction>
      <OptionsMenuAction {...option("hide")}>
        <EyeOff size={14} aria-hidden />
        <span className="flex-1">Hide this topic</span>
        {has("hide") ? <Check size={14} aria-hidden /> : null}
      </OptionsMenuAction>
      {feedback.follow ? (
        <OptionsMenuAction
          onSelect={() =>
            feedback.follow &&
            void navigate(getNotebookPath(PERSONAL_SURFACE, feedback.follow.notebookId))
          }
        >
          <BookOpen size={14} aria-hidden />
          Open the topic's notebook
        </OptionsMenuAction>
      ) : null}
    </OptionsMenu>
  );
}

export function DiscoverFollowButton({
  card,
  feedback,
}: {
  card: DiscoverCard;
  feedback: DiscoverCardFeedback;
}) {
  if (!hasDiscoverTopic(card)) {
    return null;
  }

  const following = Boolean(feedback.follow);

  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={following}
      disabled={feedback.isChangingFollow}
      icon={following ? <Check size={14} aria-hidden /> : <BellPlus size={14} aria-hidden />}
      onClick={() => feedback.onToggleFollow(card)}
    >
      {following ? "Following" : "Follow"} {cardTopic(card)}
    </Button>
  );
}
