import type { Conversation } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { isTerminalChatRunStatus } from "@ngriffin_uk/polychat-schemas";

export function getConversationRefetchInterval(
  conversation: Conversation | null | undefined,
): number | false {
  if (conversation?.latest_run && !isTerminalChatRunStatus(conversation.latest_run.status)) {
    return false;
  }

  if (conversation?.active_operation) {
    return 2_000;
  }

  const pendingMessages =
    conversation?.messages.filter((message) => message.status === "in_progress") ?? [];

  if (!pendingMessages.length) {
    return false;
  }

  const intervals = pendingMessages
    .map((message) => message.data?.asyncInvocation?.pollIntervalMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return intervals.length ? Math.max(6000, Math.min(...intervals)) : 6000;
}
