import type { ConversationManager } from "~/lib/conversationManager";
import { UnifiedPollingService } from "~/lib/async/unifiedPollingService";
import type { IEnv, Message, IUser, UnifiedAsyncInvocation } from "~/types";
import { getLogger } from "~/utils/logger";

import { bedrockAsyncInvocationHandler } from "./async/bedrock";
import type {
  UnifiedAsyncInvocationHandlerMap,
  AsyncRefreshContext,
} from "./async/types";

const logger = getLogger({
  prefix: "services/completions/refreshAsyncMessages",
});

const ASYNC_STATUS_PENDING = "in_progress";

const unifiedProviderHandlers: UnifiedAsyncInvocationHandlerMap = {
  bedrock: bedrockAsyncInvocationHandler,
  replicate: bedrockAsyncInvocationHandler, // TODO: Create dedicated replicate handler
};

function createContext(
  conversationManager: ConversationManager,
  conversationId: string,
  env: IEnv,
  user: IUser | null,
): AsyncRefreshContext {
  return {
    conversationManager,
    conversationId,
    env,
    user,
  };
}

function shouldPollMessage(
  message: Message,
  metadata?: UnifiedAsyncInvocation,
): boolean {
  if (!metadata?.provider) {
    return false;
  }

  if (message.status === ASYNC_STATUS_PENDING) {
    return true;
  }

  return metadata.status === "in_progress";
}

export async function refreshAsyncMessages({
  conversationManager,
  conversationId,
  env,
  user,
  messages,
}: {
  conversationManager: ConversationManager;
  conversationId: string;
  env: IEnv;
  user: IUser | null;
  messages: Message[];
}): Promise<Message[]> {
  if (!messages.length) {
    return messages;
  }

  const context = createContext(conversationManager, conversationId, env, user);
  const updatedMessages = [...messages];
  let hasChanges = false;

  for (const [index, message] of messages.entries()) {
    const asyncInvocation = (message.data as Record<string, any> | undefined)
      ?.asyncInvocation as UnifiedAsyncInvocation | undefined;

    if (!asyncInvocation || !shouldPollMessage(message, asyncInvocation)) {
      continue;
    }

    const handler = unifiedProviderHandlers[asyncInvocation.provider];

    if (!handler) {
      continue;
    }

    try {
      const result = await handler(asyncInvocation, message, context);
      updatedMessages[index] = result.message;
      hasChanges = true;
    } catch (error) {
      logger.error("Failed to refresh async invocation", {
        error,
        provider: asyncInvocation.provider,
        id: asyncInvocation.id,
      });
    }
  }

  return hasChanges ? updatedMessages : messages;
}
