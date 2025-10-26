import type { ConversationManager } from "~/lib/conversationManager";
import { BedrockProvider } from "~/lib/providers/bedrock";
import type { ChatCompletionParameters, IEnv, Message, IUser } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({
  prefix: "services/completions/refreshAsyncMessages",
});

type AsyncInvocationMetadata = {
  provider: string;
  invocationArn: string;
  invocationUrl?: string;
  pollIntervalMs?: number;
  status?: string;
  lastCheckedAt?: number;
  completedAt?: number;
  initialResponse?: Record<string, any>;
  [key: string]: any;
};

interface RefreshContext {
  conversationManager: ConversationManager;
  conversationId: string;
  env: IEnv;
  user: IUser | null;
}

const ASYNC_STATUS_PENDING = "in_progress";

async function handleBedrockAsyncInvocation(
  metadata: AsyncInvocationMetadata,
  message: Message,
  context: RefreshContext,
): Promise<
  | { status: "completed"; message: Message }
  | { status: "failed"; message: Message }
  | { status: "in_progress"; message: Message }
> {
  const provider = new BedrockProvider();

  const params: ChatCompletionParameters = {
    model: message.model,
    env: context.env,
    messages: [],
    completion_id: context.conversationId,
  } as ChatCompletionParameters;

  const result = await provider.getAsyncInvocationStatus(
    metadata.invocationArn,
    params,
    context.user?.id,
    metadata.initialResponse,
  );

  const now = Date.now();

  if (result.status === "completed" && result.result) {
    const formatted = result.result;

    const previousAsyncInvocation =
      (message.data as Record<string, any> | undefined)?.asyncInvocation;
    const formattedAsyncInvocation =
      (formatted.data as Record<string, any> | undefined)?.asyncInvocation;

    const mergedAsyncInvocation = {
      ...(previousAsyncInvocation || {}),
      ...(formattedAsyncInvocation || {}),
      ...metadata,
      status: "completed" as const,
      completedAt: now,
      lastCheckedAt: now,
    };

    const mergedData = {
      ...(message.data || {}),
      ...(formatted.data || {}),
      asyncInvocation: mergedAsyncInvocation,
    };

    const updatedMessage: Message = {
      ...message,
      content: formatted.response ?? message.content,
      citations: formatted.citations ?? message.citations,
      data: mergedData,
      log_id: formatted.log_id ?? message.log_id,
      status: "completed",
      tool_calls: formatted.tool_calls ?? message.tool_calls,
      usage: formatted.usage ?? formatted.usageMetadata ?? message.usage,
    };

    await context.conversationManager.update(context.conversationId, [
      updatedMessage,
    ]);

    return { status: "completed", message: updatedMessage };
  }

  if (result.status === "failed") {
    const updatedMessage: Message = {
      ...message,
      content: [
        {
          type: "text",
          text: "Video generation failed. Please try again.",
        },
      ],
      status: "failed",
      data: {
        ...(message.data || {}),
        asyncInvocation: {
          ...metadata,
          status: "failed",
          lastCheckedAt: now,
        },
        error: result.raw?.status || "FAILED",
      },
    } as Message;

    await context.conversationManager.update(context.conversationId, [
      updatedMessage,
    ]);

    return { status: "failed", message: updatedMessage };
  }

  const inProgressMessage: Message = {
    ...message,
    data: {
      ...(message.data || {}),
      asyncInvocation: {
        ...metadata,
        status: metadata.status || ASYNC_STATUS_PENDING,
        lastCheckedAt: now,
      },
    },
  } as Message;

  await context.conversationManager.update(context.conversationId, [
    inProgressMessage,
  ]);

  return { status: "in_progress", message: inProgressMessage };
}

const providerHandlers: Record<
  string,
  (
    metadata: AsyncInvocationMetadata,
    message: Message,
    context: RefreshContext,
  ) => Promise<
    | { status: "completed"; message: Message }
    | { status: "failed"; message: Message }
    | { status: "in_progress"; message: Message }
  >
> = {
  bedrock: handleBedrockAsyncInvocation,
};

export async function refreshAsyncMessages({
  conversationManager,
  conversationId,
  env,
  user,
  messages,
}: RefreshContext & { messages: Message[] }): Promise<Message[]> {
  if (!messages.length) {
    return messages;
  }

  const updatedMessages = [...messages];
  let hasChanges = false;

  for (const [index, message] of messages.entries()) {
    const messageData = message.data as Record<string, any> | undefined;
    const asyncInvocation =
      messageData?.asyncInvocation as AsyncInvocationMetadata | undefined;

    if (
      message.status !== ASYNC_STATUS_PENDING ||
      !asyncInvocation ||
      !asyncInvocation.provider
    ) {
      continue;
    }

    const handler = providerHandlers[asyncInvocation.provider];
    if (!handler) {
      continue;
    }

    try {
      const result = await handler(asyncInvocation, message, {
        conversationManager,
        conversationId,
        env,
        user,
      });

      updatedMessages[index] = result.message;
      hasChanges = true;

      if (result.status === "completed" || result.status === "failed") {
        continue;
      }
    } catch (error) {
      logger.error("Failed to refresh async invocation", {
        error,
        provider: asyncInvocation.provider,
        invocationArn: asyncInvocation.invocationArn,
      });
    }
  }

  return hasChanges ? updatedMessages : messages;
}
