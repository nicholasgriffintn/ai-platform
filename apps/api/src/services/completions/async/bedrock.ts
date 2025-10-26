import { UnifiedPollingService } from "~/lib/async/unifiedPollingService";
import type {
  ChatCompletionParameters,
  Message,
  UnifiedAsyncInvocation,
} from "~/types";
import { getLogger } from "~/utils/logger";

import type {
  UnifiedAsyncInvocationHandler,
  AsyncRefreshContext,
  AsyncRefreshResult,
} from "./types";

const logger = getLogger({
  prefix: "services/completions/async/bedrock",
});

function buildBaseParams(
  message: Message,
  context: AsyncRefreshContext,
): ChatCompletionParameters {
  return {
    model: message.model,
    env: context.env,
    messages: [],
    completion_id: context.conversationId,
  } as ChatCompletionParameters;
}

async function handleCompletion(
  metadata: UnifiedAsyncInvocation,
  message: Message,
  context: AsyncRefreshContext,
  formattedResult: any,
  raw: Record<string, any>,
): Promise<AsyncRefreshResult> {
  const now = Date.now();
  const updatedMetadata: UnifiedAsyncInvocation = {
    ...metadata,
    status: "completed",
    completedAt: now,
    lastCheckedAt: now,
    result: formattedResult,
  };

  const mergedData = {
    ...(message.data || {}),
    ...(formattedResult?.data || {}),
    asyncInvocation: updatedMetadata,
  };

  const updatedMessage: Message = {
    ...message,
    content: formattedResult.response ?? message.content,
    citations: formattedResult.citations ?? message.citations,
    data: mergedData,
    log_id: formattedResult.log_id ?? message.log_id,
    status: "completed",
    tool_calls: formattedResult.tool_calls ?? message.tool_calls,
    usage:
      formattedResult.usage ?? formattedResult.usageMetadata ?? message.usage,
  };

  await context.conversationManager.update(context.conversationId, [
    updatedMessage,
  ]);

  return { status: "completed", message: updatedMessage };
}

async function handleFailure(
  metadata: UnifiedAsyncInvocation,
  message: Message,
  context: AsyncRefreshContext,
  raw: Record<string, any>,
): Promise<AsyncRefreshResult> {
  const now = Date.now();
  const updatedMetadata: UnifiedAsyncInvocation = {
    ...metadata,
    status: "failed",
    lastCheckedAt: now,
    error: raw?.error || raw?.status || "FAILED",
  };

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
      asyncInvocation: updatedMetadata,
      error: raw?.status || "FAILED",
    },
  } as Message;

  await context.conversationManager.update(context.conversationId, [
    updatedMessage,
  ]);

  return { status: "failed", message: updatedMessage };
}

async function handleProgress(
  metadata: UnifiedAsyncInvocation,
  message: Message,
  context: AsyncRefreshContext,
  raw: Record<string, any>,
): Promise<AsyncRefreshResult> {
  const now = Date.now();
  const updatedMetadata: UnifiedAsyncInvocation = {
    ...metadata,
    status: "in_progress",
    lastCheckedAt: now,
  };

  const inProgressMessage: Message = {
    ...message,
    data: {
      ...(message.data || {}),
      asyncInvocation: updatedMetadata,
    },
    status: "in_progress",
  } as Message;

  await context.conversationManager.update(context.conversationId, [
    inProgressMessage,
  ]);

  return { status: "in_progress", message: inProgressMessage };
}

export const bedrockAsyncInvocationHandler: UnifiedAsyncInvocationHandler =
  async (metadata, message, context) => {
    const params = buildBaseParams(message, context);

    try {
      const result = await UnifiedPollingService.pollStatus(
        metadata,
        params,
        context.user?.id,
      );

      if (result.status === "completed" && result.result) {
        return handleCompletion(
          metadata,
          message,
          context,
          result.result,
          result.metadata,
        );
      }

      if (result.status === "failed") {
        return handleFailure(metadata, message, context, result.metadata);
      }

      return handleProgress(metadata, message, context, result.metadata);
    } catch (error) {
      logger.error("Failed to refresh Bedrock async invocation", {
        error,
        provider: metadata.provider,
        id: metadata.id,
      });

      return handleProgress(
        metadata,
        message,
        context,
        metadata.initialResponse || {},
      );
    }
  };
