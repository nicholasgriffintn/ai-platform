import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";

export interface LatestUserMessage {
  id?: string;
  index: number;
  text: string;
}

export function findLatestUserMessage(
  history: readonly { id?: string; role: string; content: unknown }[],
): LatestUserMessage | null {
  for (let index = history.length - 1; index >= 0; index--) {
    const message = history[index];

    if (message.role === "user") {
      return {
        ...(message.id ? { id: message.id } : {}),
        index,
        text: extractTextFromMessageContent(message.content),
      };
    }
  }

  return null;
}
