import { CONVERSATION_LOCK_CONTEXT_TOKEN_CAP } from "@ngriffin_uk/polychat-schemas";

/** Rough characters-per-token ratio, good enough to stop a thread before a provider does. */
const CHARS_PER_TOKEN = 4;

export interface LockedContextUsage {
  cap: number;
  estimatedTokens: number;
  isOverCap: boolean;
  remainingTokens: number;
}

function textLength(content: unknown): number {
  if (typeof content === "string") {
    return content.length;
  }

  if (Array.isArray(content)) {
    return content.reduce<number>((total, part) => total + textLength(part), 0);
  }

  if (content && typeof content === "object") {
    const text = (content as { text?: unknown }).text;

    return typeof text === "string" ? text.length : 0;
  }

  return 0;
}

/**
 * A locked conversation cannot be compacted on the server, because the server cannot read
 * it. Rather than silently dropping the oldest turns, the composer stops at the cap and
 * says so, leaving the user to start a new locked conversation.
 */
export function measureLockedContext(
  messages: readonly { content?: unknown }[],
  cap = CONVERSATION_LOCK_CONTEXT_TOKEN_CAP,
): LockedContextUsage {
  const characters = messages.reduce<number>(
    (total, message) => total + textLength(message.content),
    0,
  );
  const estimatedTokens = Math.ceil(characters / CHARS_PER_TOKEN);

  return {
    cap,
    estimatedTokens,
    isOverCap: estimatedTokens >= cap,
    remainingTokens: Math.max(0, cap - estimatedTokens),
  };
}

export const LOCKED_CONTEXT_CAP_MESSAGE =
  "This locked conversation has reached its length limit. Locked chats cannot be compacted, because Polychat cannot read them. Start a new locked chat to keep going.";
