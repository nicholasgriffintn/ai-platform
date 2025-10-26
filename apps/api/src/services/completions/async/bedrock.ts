import { BedrockProvider } from "~/lib/providers/bedrock";
import { mergeAsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import type { ChatCompletionParameters, Message } from "~/types";
import { getLogger } from "~/utils/logger";

import type {
  AsyncInvocationHandler,
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
  metadata: AsyncInvocationMetadata,
  message: Message,
  context: AsyncRefreshContext,
  formattedResult: any,
  raw: Record<string, any>,
): Promise<AsyncRefreshResult> {
  const previous = (message.data as Record<string, any> | undefined)?.asyncInvocation as
    | AsyncInvocationMetadata
    | undefined;
  const now = Date.now();
  const mergedInvocation = mergeAsyncInvocationMetadata(previous, {
    ...metadata,
    status: "completed",
    completedAt: now,
    lastCheckedAt: now,
    lastResult: raw,
  });

  const mergedData = {
    ...(message.data || {}),
    ...(formattedResult?.data || {}),
    asyncInvocation: mergedInvocation,
  };

  const updatedMessage: Message = {
    ...message,
    content: formattedResult.response ?? message.content,
    citations: formattedResult.citations ?? message.citations,
    data: mergedData,
    log_id: formattedResult.log_id ?? message.log_id,
    status: "completed",
    tool_calls: formattedResult.tool_calls ?? message.tool_calls,
    usage: formattedResult.usage ?? formattedResult.usageMetadata ?? message.usage,
  };

  await context.conversationManager.update(context.conversationId, [
    updatedMessage,
  ]);

  return { status: "completed", message: updatedMessage };
}

async function handleFailure(
  metadata: AsyncInvocationMetadata,
  message: Message,
  context: AsyncRefreshContext,
  raw: Record<string, any>,
): Promise<AsyncRefreshResult> {
  const previous = (message.data as Record<string, any> | undefined)?.asyncInvocation as
    | AsyncInvocationMetadata
    | undefined;
  const now = Date.now();
  const mergedInvocation = mergeAsyncInvocationMetadata(previous, {
    ...metadata,
    status: "failed",
    lastCheckedAt: now,
    lastResult: raw,
  });

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
      asyncInvocation: mergedInvocation,
      error: raw?.status || "FAILED",
    },
  } as Message;

  await context.conversationManager.update(context.conversationId, [
    updatedMessage,
  ]);

  return { status: "failed", message: updatedMessage };
}

async function handleProgress(
  metadata: AsyncInvocationMetadata,
  message: Message,
  context: AsyncRefreshContext,
  raw: Record<string, any>,
): Promise<AsyncRefreshResult> {
  const previous = (message.data as Record<string, any> | undefined)?.asyncInvocation as
    | AsyncInvocationMetadata
    | undefined;
  const mergedInvocation = mergeAsyncInvocationMetadata(previous, {
    ...metadata,
    status: "in_progress",
    lastCheckedAt: Date.now(),
    lastResult: raw,
  });

  const inProgressMessage: Message = {
    ...message,
    data: {
      ...(message.data || {}),
      asyncInvocation: mergedInvocation,
    },
    status: "in_progress",
  } as Message;

  await context.conversationManager.update(context.conversationId, [
    inProgressMessage,
  ]);

  return { status: "in_progress", message: inProgressMessage };
}

export const bedrockAsyncInvocationHandler: AsyncInvocationHandler = async (
  metadata,
  message,
  context,
) => {
  const provider = new BedrockProvider();

  const params = buildBaseParams(message, context);

  try {
    const result = await provider.getAsyncInvocationStatus(
      metadata.invocationArn,
      params,
      context.user?.id,
      metadata.initialResponse,
    );

    if (result.status === "completed" && result.result) {
      return handleCompletion(metadata, message, context, result.result, result.raw);
    }

    if (result.status === "failed") {
      return handleFailure(metadata, message, context, result.raw);
    }

    return handleProgress(metadata, message, context, result.raw);
  } catch (error) {
    logger.error("Failed to refresh Bedrock async invocation", {
      error,
      provider: metadata.provider,
      invocationArn: metadata.invocationArn,
    });

    return handleProgress(metadata, message, context, metadata.initialResponse || {});
  }
};
