import { AIProviderFactory } from "~/lib/providers/factory";
import {
  createAsyncInvocationMetadata,
  mergeAsyncInvocationMetadata,
} from "~/lib/async/asyncInvocation";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import type { ChatCompletionParameters, Message } from "~/types";
import { getLogger } from "~/utils/logger";

import type {
  AsyncInvocationHandler,
  AsyncRefreshContext,
  AsyncRefreshResult,
} from "./types";

const logger = getLogger({
  prefix: "services/completions/async/handler",
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

function resolveContent(
  fallback: Message["content"],
  hint?: Message["content"],
): Message["content"] {
  if (!hint) {
    return fallback;
  }

  if (Array.isArray(hint) && hint.length === 0) {
    return fallback;
  }

  return hint;
}

function resolveHint(
  metadata: AsyncInvocationMetadata,
  key: keyof NonNullable<AsyncInvocationMetadata["contentHints"]>,
): Message["content"] | undefined {
  return metadata.contentHints?.[
    key as "placeholder" | "progress" | "failure"
  ] as Message["content"] | undefined;
}

async function handleCompletion(
  metadata: AsyncInvocationMetadata,
  message: Message,
  context: AsyncRefreshContext,
  formattedResult: any,
  raw: Record<string, any>,
): Promise<AsyncRefreshResult> {
  const previous =
    ((message.data as Record<string, any> | undefined)?.asyncInvocation as
      | AsyncInvocationMetadata
      | undefined) || metadata;

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
    content: formattedResult?.response ?? message.content,
    citations: formattedResult?.citations ?? message.citations,
    data: mergedData,
    log_id: formattedResult?.log_id ?? message.log_id,
    status: "completed",
    tool_calls: formattedResult?.tool_calls ?? message.tool_calls,
    usage:
      formattedResult?.usage ?? formattedResult?.usageMetadata ?? message.usage,
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
  const previous =
    ((message.data as Record<string, any> | undefined)?.asyncInvocation as
      | AsyncInvocationMetadata
      | undefined) || metadata;

  const now = Date.now();
  const mergedInvocation = mergeAsyncInvocationMetadata(previous, {
    ...metadata,
    status: "failed",
    lastCheckedAt: now,
    lastResult: raw,
  });

  const failureContent = resolveContent(
    message.content,
    resolveHint(metadata, "failure"),
  );

  const updatedMessage: Message = {
    ...message,
    content: failureContent,
    status: "failed",
    data: {
      ...(message.data || {}),
      asyncInvocation: mergedInvocation,
      error: raw?.error || raw?.status || "FAILED",
    },
  };

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
  const previous =
    ((message.data as Record<string, any> | undefined)?.asyncInvocation as
      | AsyncInvocationMetadata
      | undefined) || metadata;

  const mergedInvocation = mergeAsyncInvocationMetadata(previous, {
    ...metadata,
    status: "in_progress",
    lastCheckedAt: Date.now(),
    lastResult: raw,
  });

  const progressContent = resolveContent(
    message.content,
    resolveHint(metadata, "progress") ?? resolveHint(metadata, "placeholder"),
  );

  const inProgressMessage: Message = {
    ...message,
    content: progressContent,
    data: {
      ...(message.data || {}),
      asyncInvocation: mergedInvocation,
    },
    status: "in_progress",
  };

  await context.conversationManager.update(context.conversationId, [
    inProgressMessage,
  ]);

  return { status: "in_progress", message: inProgressMessage };
}

export const handleAsyncInvocation: AsyncInvocationHandler = async (
  metadata,
  message,
  context,
): Promise<AsyncRefreshResult> => {
  const availableProviders = AIProviderFactory.getProviders();

  if (!availableProviders.includes(metadata.provider)) {
    logger.warn("Skipping async refresh for unknown provider", {
      provider: metadata.provider,
    });

    // @ts-ignore
    return { status: message.status ?? "in_progress", message };
  }

  const provider = AIProviderFactory.getProvider(metadata.provider);

  if (!provider?.getAsyncInvocationStatus) {
    logger.warn("Provider does not support async polling", {
      provider: metadata.provider,
    });

    return handleProgress(
      createAsyncInvocationMetadata(metadata),
      message,
      context,
      metadata.initialResponse || {},
    );
  }

  const params = buildBaseParams(message, context);

  try {
    const result = await provider.getAsyncInvocationStatus(
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
        result.raw,
      );
    }

    if (result.status === "failed") {
      return handleFailure(metadata, message, context, result.raw);
    }

    return handleProgress(metadata, message, context, result.raw);
  } catch (error) {
    logger.error("Failed to refresh async invocation", {
      error,
      provider: metadata.provider,
      id: metadata.id,
      type: metadata.type,
    });

    return handleProgress(
      metadata,
      message,
      context,
      metadata.initialResponse || {},
    );
  }
};
