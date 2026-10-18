import { messageReactionsSchema, type MessageReaction } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
  byTeammate: boolean;
}

export function readMessageReactions(data: unknown): MessageReaction[] {
  if (!isRecord(data)) {
    return [];
  }

  const parsed = messageReactionsSchema.safeParse(data.reactions);

  return parsed.success ? parsed.data : [];
}

function isSameReaction(left: MessageReaction, right: MessageReaction): boolean {
  return (
    left.emoji === right.emoji && left.actor === right.actor && left.actor_id === right.actor_id
  );
}

export function applyMessageReaction(
  reactions: readonly MessageReaction[],
  reaction: MessageReaction,
  remove = false,
): MessageReaction[] {
  const others = reactions.filter((existing) => !isSameReaction(existing, reaction));

  return remove ? others : [...others, reaction];
}

export function withMessageReactions(
  data: unknown,
  reactions: readonly MessageReaction[],
): Record<string, unknown> {
  const base = isRecord(data) ? data : {};

  return { ...base, reactions: [...reactions] };
}

export function summariseMessageReactions(
  reactions: readonly MessageReaction[],
  viewerId: string | undefined,
): ReactionSummary[] {
  const summaries = new Map<string, ReactionSummary>();

  for (const reaction of reactions) {
    const summary = summaries.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      mine: false,
      byTeammate: false,
    };

    summaries.set(reaction.emoji, {
      ...summary,
      count: summary.count + 1,
      mine: summary.mine || (reaction.actor === "person" && reaction.actor_id === viewerId),
      byTeammate: summary.byTeammate || reaction.actor === "teammate",
    });
  }

  return [...summaries.values()];
}

export function reactionFeedbackValue(emoji: string): 1 | -1 | undefined {
  if (emoji === "👍" || emoji === "❤️" || emoji === "🎉") {
    return 1;
  }

  if (emoji === "👎") {
    return -1;
  }

  return undefined;
}

export interface ReactedMessage {
  emoji: string;
  excerpt: string;
}

const REACTION_CONTEXT_LIMIT = 5;
const REACTION_EXCERPT_LENGTH = 120;

function readMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join(" ");
  }

  return "";
}

export function collectPersonReactions(
  messages: readonly { role: string; content?: unknown; data?: unknown }[],
): ReactedMessage[] {
  const reacted: ReactedMessage[] = [];

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    const emojis = readMessageReactions(message.data)
      .filter((reaction) => reaction.actor === "person")
      .map((reaction) => reaction.emoji);

    if (emojis.length === 0) {
      continue;
    }

    const text = readMessageText(message.content).replace(/\s+/g, " ").trim();

    reacted.push({
      emoji: emojis.join(" "),
      excerpt:
        text.length > REACTION_EXCERPT_LENGTH ? `${text.slice(0, REACTION_EXCERPT_LENGTH)}…` : text,
    });
  }

  return reacted.slice(-REACTION_CONTEXT_LIMIT);
}
