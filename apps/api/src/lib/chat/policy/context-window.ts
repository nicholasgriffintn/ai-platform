import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { estimateMessageTokens, estimateTextTokens } from "~/lib/messageTokens";
import type { Message } from "~/types/chat";
import { AssistantError, ErrorType } from "~/utils/errors";

const FALLBACK_CONTEXT_WINDOW = 8000;

type ContextWindowSource = Pick<ModelConfigItem, "contextWindow"> | null | undefined;

function resolveContextWindow(modelConfig: ContextWindowSource): number {
  return modelConfig?.contextWindow || FALLBACK_CONTEXT_WINDOW;
}

/**
 * Guard the request before it reaches a provider. Pruning runs first at every call
 * site, so this only fires when the incoming content alone overruns the window.
 */
export function checkContextWindowLimits(
  messages: Message[],
  newContent: string,
  modelConfig: ContextWindowSource,
): void {
  const maxContextLength = resolveContextWindow(modelConfig);
  const totalTokens =
    messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0) +
    estimateTextTokens(newContent);

  if (totalTokens > maxContextLength) {
    throw new AssistantError(
      `Content exceeds model context window (estimated ${totalTokens} tokens, limit ${maxContextLength})`,
      ErrorType.CONTEXT_WINDOW_EXCEEDED,
    );
  }
}

/**
 * Drop whole messages from the front until the history plus the incoming content fits.
 */
export function pruneMessagesToFitContext(
  messages: Message[],
  newContent: string,
  modelConfig: ContextWindowSource,
): Message[] {
  const maxContextLength = resolveContextWindow(modelConfig);
  const newTokens = estimateTextTokens(newContent);
  const pruned = [...messages];

  let existingTokens = pruned.reduce((sum, message) => sum + estimateMessageTokens(message), 0);

  while (existingTokens + newTokens > maxContextLength && pruned.length > 0) {
    const removed = pruned.shift();

    if (!removed) {
      break;
    }

    existingTokens -= estimateMessageTokens(removed);
  }

  return pruned;
}
