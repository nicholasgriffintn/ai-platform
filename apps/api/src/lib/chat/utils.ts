import type { Message } from "~/types/chat";
import { AssistantError, ErrorType } from "~/utils/errors";

export function checkContextWindowLimits(
  messages: Message[],
  newContent: string,
  modelConfig: any,
): void {
  // Default max context if not specified in model config (conservative estimate)
  const MAX_CONTEXT_LENGTH = modelConfig?.contextWindow || 8000;

  // Estimate token count based on characters (rough approximation)
  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  // Calculate existing conversation token count
  let existingTokenCount = 0;
  for (const msg of messages) {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    existingTokenCount += estimateTokens(content);

    // Add extra tokens for role prefixes and message separators
    existingTokenCount += 4;
  }

  // Calculate new content token count
  const newContentTokens = estimateTokens(newContent);

  // Total tokens
  const totalTokens = existingTokenCount + newContentTokens;

  // Check if we exceed limits
  if (totalTokens > MAX_CONTEXT_LENGTH) {
    throw new AssistantError(
      `Content exceeds model context window (estimated ${totalTokens} tokens, limit ${MAX_CONTEXT_LENGTH})`,
      ErrorType.CONTEXT_WINDOW_EXCEEDED,
    );
  }
}
