import { mergeParametersWithDefaults } from "~/lib/chat/parameters";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { AIProviderFactory } from "~/providers/factory";
import type { ChatCompletionParameters, Message } from "~/types";
import type { AssistantMessageData } from "~/types/chat";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { formatMessages } from "~/utils/messages";
import { withRetry } from "~/utils/retries";

const responseLogger = getLogger({ prefix: "CHAT_RESPONSE" });

/**
 * Formats assistant message data into a standardized structure that can be used
 * by both streaming and non-streaming response handlers
 */
export function formatAssistantMessage({
  content = "",
  thinking = "",
  signature = "",
  citations = [],
  tool_calls = [],
  data = null,
  usage = null,
  guardrails = { passed: true },
  log_id = null,
  model = "",
  selected_models = [],
  platform = "api",
  timestamp = Date.now(),
  id = generateId(),
  finish_reason = null,
  mode,
}: Partial<AssistantMessageData>): AssistantMessageData {
  if (tool_calls && !Array.isArray(tool_calls)) {
    responseLogger.warn("Invalid tool_calls format, expected array", {
      tool_calls,
    });
    tool_calls = [];
  }

  if (citations && !Array.isArray(citations)) {
    responseLogger.warn("Invalid citations format, expected array", {
      citations,
    });
    citations = [];
  }

  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    responseLogger.warn("Invalid timestamp, using current time", { timestamp });
    timestamp = Date.now();
  }

  const determinedFinishReason =
    finish_reason || (tool_calls?.length ? "tool_calls" : "stop");

  const finalUsage = usage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  let messageContent: string | Array<any> = content;
  if (thinking || signature) {
    const contentBlocks = [];
    if (thinking) {
      contentBlocks.push({
        type: "thinking",
        thinking,
        signature: signature || "",
      });
    }
    if (content) {
      contentBlocks.push({
        type: "text",
        text: content,
      });
    }
    messageContent = contentBlocks;
  }

  return {
    content: content,
    thinking,
    signature,
    citations,
    tool_calls,
    data,
    usage: finalUsage,
    guardrails,
    log_id,
    model,
    selected_models,
    platform,
    timestamp,
    id,
    finish_reason: determinedFinishReason,
    mode,
  };
}

export async function getAIResponse({
  app_url,
  system_prompt,
  env,
  user,
  mode,
  model,
  messages,
  message,
  enabled_tools,
  tools,
  ...params
}: ChatCompletionParameters) {
  if (!model) {
    throw new AssistantError("Model is required", ErrorType.PARAMS_ERROR);
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new AssistantError(
      "Messages array is required and cannot be empty",
      ErrorType.PARAMS_ERROR,
    );
  }

  let modelConfig;
  try {
    modelConfig = getModelConfigByMatchingModel(model);
    if (!modelConfig) {
      throw new AssistantError(
        `Model configuration not found for ${model}`,
        ErrorType.PARAMS_ERROR,
      );
    }
  } catch (error: any) {
    responseLogger.error("Failed to get model configuration", { model, error });
    throw new AssistantError(
      `Invalid model configuration for ${model}: ${error.message}`,
      ErrorType.PARAMS_ERROR,
    );
  }

  let provider;
  try {
    provider = AIProviderFactory.getProvider(
      modelConfig?.provider || "workers-ai",
    );
  } catch (error: any) {
    responseLogger.error("Failed to initialize provider", {
      provider: modelConfig?.provider,
      error,
    });
    throw new AssistantError(
      `Failed to initialize provider ${modelConfig?.provider}: ${error.message}`,
      ErrorType.PROVIDER_ERROR,
    );
  }

  const filteredMessages =
    mode === "normal"
      ? messages.filter((msg: Message) => !msg.mode || msg.mode === "normal")
      : messages;

  if (filteredMessages.length === 0) {
    responseLogger.warn("No messages after filtering", { mode });
    throw new AssistantError(
      "No valid messages after filtering",
      ErrorType.PARAMS_ERROR,
    );
  }

  let formattedMessages;
  try {
    formattedMessages = formatMessages(
      provider.name,
      filteredMessages,
      system_prompt,
      model,
    );
  } catch (error: any) {
    responseLogger.error("Failed to format messages", { error });
    throw new AssistantError(
      `Failed to format messages: ${error.message}`,
      ErrorType.PARAMS_ERROR,
    );
  }

  // Append <think> tag for Qwen QwQ models
  let finalFormattedMessages = formattedMessages;
  if (modelConfig?.matchingModel?.includes("qwq")) {
    try {
      const lastMessageIndex = formattedMessages.length - 1;
      if (lastMessageIndex >= 0) {
        const lastMessage = formattedMessages[lastMessageIndex];
        if (typeof lastMessage.content === "string") {
          const updatedLastMessage = {
            ...lastMessage,
            content: `${lastMessage.content}\n<think>\n`,
          };
          finalFormattedMessages = [...formattedMessages];
          finalFormattedMessages[lastMessageIndex] = updatedLastMessage;
        }
      }
    } catch (error: any) {
      responseLogger.warn("Failed to append <think> tag", { error });
      finalFormattedMessages = formattedMessages;
    }
  }

  let shouldStream = false;
  const modelTypeIsText = modelConfig?.type?.includes("text");
  const modelTypeIsCoding = modelConfig?.type?.includes("coding");
  const modelTypeSupportsStreaming = modelTypeIsText || modelTypeIsCoding;
  if (
    params.stream &&
    provider.supportsStreaming &&
    modelTypeSupportsStreaming
  ) {
    shouldStream = true;
  }

  let parameters;
  try {
    parameters = mergeParametersWithDefaults({
      ...params,
      model,
      messages: finalFormattedMessages,
      message,
      mode,
      app_url,
      system_prompt,
      env,
      user,
      stream: shouldStream,
      enabled_tools,
      tools,
    });
  } catch (error: any) {
    responseLogger.error("Failed to merge parameters", { error });
    throw new AssistantError(
      `Failed to prepare request parameters: ${error.message}`,
      ErrorType.PARAMS_ERROR,
    );
  }

  const startTime = Date.now();
  let response;
  try {
    response = await withRetry(
      () => provider.getResponse(parameters, user?.id),
      {
        retryCount: 3,
        baseDelayMs: 1000,
      },
    );
  } catch (err: any) {
    let errorType = ErrorType.PROVIDER_ERROR;
    if (err.message?.includes("rate limit") || err.status === 429) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
    } else if (err.status >= 500) {
      errorType = ErrorType.PROVIDER_ERROR;
    } else if (err.status === 401 || err.status === 403) {
      errorType = ErrorType.AUTHENTICATION_ERROR;
    }

    responseLogger.error("Model invocation failed", {
      model,
      provider: provider.name,
      error: err,
      errorType,
    });

    throw new AssistantError(
      `${provider.name} error: ${err.message || "Unknown error"}`,
      errorType,
      err,
    );
  }
  const durationMs = Date.now() - startTime;
  const usageTokens =
    typeof response === "object" && response && "usage" in response
      ? (response as any).usage.total_tokens
      : null;
  responseLogger.debug("Model invocation metrics", {
    model,
    provider: provider.name,
    durationMs,
    usageTokens,
  });

  if (!response) {
    throw new AssistantError(
      "Provider returned empty response",
      ErrorType.PROVIDER_ERROR,
    );
  }

  return response;
}
