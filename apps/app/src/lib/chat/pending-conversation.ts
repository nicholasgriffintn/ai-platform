import type { Conversation } from "~/types";

const MAX_UNACKNOWLEDGED_TURN_MS = 180_000;

export function recoverUnacknowledgedConversation(
  local: Conversation | null | undefined,
  remote?: Conversation | null,
  now = Date.now(),
): Conversation | null {
  const placeholder = local?.messages.at(-1);

  if (!local || placeholder?.role !== "assistant" || placeholder.status !== "in_progress") {
    return null;
  }

  const localUser = local.messages
    .slice()
    .reverse()
    .find((message) => message.role === "user");
  const knownIds = new Set(local.messages.map((message) => message.id));
  const hasStoredTurn = remote?.messages.some(
    (message) =>
      (message.role === "user" && message.id === localUser?.id) ||
      (message.id && !knownIds.has(message.id)),
  );

  if (hasStoredTurn || remote?.active_operation) {
    return null;
  }

  const startedAt = placeholder.timestamp ?? placeholder.created;
  const isRecent = typeof startedAt === "number" && now - startedAt < MAX_UNACKNOWLEDGED_TURN_MS;

  return {
    ...local,
    active_operation: isRecent ? "user_message" : null,
    messages: isRecent ? local.messages : local.messages.slice(0, -1),
  };
}
