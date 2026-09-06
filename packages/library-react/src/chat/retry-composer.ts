interface RetryContextMessage {
  role: string;
  content: unknown;
}

export function getComposerDraftAfterRetry(
  currentDraft: string,
  messages: readonly RetryContextMessage[],
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "user" && message.content === currentDraft) {
      return "";
    }

    if (message.role === "user") {
      return currentDraft;
    }
  }

  return currentDraft;
}
