import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  readMessageReactions,
  reactionFeedbackValue,
  summariseMessageReactions,
  type ReactionSummary,
} from "@ngriffin_uk/polychat-library-chat/reactions";
import type { MessageReaction } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export type MessageReactionHandler = (
  emoji: string,
  remove: boolean,
) => Promise<MessageReaction[] | undefined>;

export interface MessageReactionsState {
  summaries: ReactionSummary[];
  isPending: boolean;
  toggle: (emoji: string) => Promise<void>;
}

export function useMessageReactions({
  message,
  viewerId,
  onReact,
  onMood,
}: {
  message: Message;
  viewerId: string | undefined;
  onReact?: MessageReactionHandler;
  onMood?: (mood: "cheer" | "fret") => void;
}): MessageReactionsState {
  const [local, setLocal] = useState<{ source: unknown; reactions: MessageReaction[] } | null>(
    null,
  );
  const [isPending, setIsPending] = useState(false);
  const reactions =
    local && local.source === message.data ? local.reactions : readMessageReactions(message.data);

  const summaries = summariseMessageReactions(reactions, viewerId);

  const toggle = async (emoji: string) => {
    if (!onReact || isPending) {
      return;
    }

    const remove = summaries.some((summary) => summary.emoji === emoji && summary.mine);

    setIsPending(true);
    try {
      const next = await onReact(emoji, remove);

      if (next) {
        setLocal({ source: message.data, reactions: next });
      }

      const feedback = remove ? undefined : reactionFeedbackValue(emoji);

      if (feedback) {
        onMood?.(feedback === 1 ? "cheer" : "fret");
      }
    } finally {
      setIsPending(false);
    }
  };

  return { summaries, isPending, toggle };
}
