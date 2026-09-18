import type { SubmitChatCompletionFeedbackInput } from "@ngriffin_uk/polychat-schemas";

export interface ChatFeedbackTargetMessage {
  id: string;
  role: string;
  log_id?: string;
  run_id?: string;
}

export function resolveFeedbackTarget(
  messages: ChatFeedbackTargetMessage[],
  request: Pick<SubmitChatCompletionFeedbackInput, "message_id" | "log_id">,
): ChatFeedbackTargetMessage | undefined {
  if (request.message_id) {
    return messages.find((message) => message.id === request.message_id);
  }

  if (request.log_id) {
    return messages.find((message) => message.log_id === request.log_id);
  }

  return [...messages].reverse().find((message) => message.role === "assistant");
}
