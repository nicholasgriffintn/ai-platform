import { mergeParametersWithDefaults } from "~/lib/chat/parameters";
import { getModelConfigByMatchingModel } from "~/lib/models";
import { AIProviderFactory } from "~/providers/factory";
import type { ChatCompletionParameters, Message } from "~/types";
import type { AssistantMessageData } from "~/types/chat";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { formatMessages } from "~/utils/messages";

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
  finish_reason = tool_calls.length ? "tool_calls" : "stop",
  mode,
}: Partial<AssistantMessageData>): AssistantMessageData {
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
    finish_reason,
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

  const modelConfig = getModelConfigByMatchingModel(model);
  const provider = AIProviderFactory.getProvider(
    modelConfig?.provider || "workers-ai",
  );

  const filteredMessages =
    mode === "normal"
      ? messages.filter((msg: Message) => !msg.mode || msg.mode === "normal")
      : messages;

  const formattedMessages = formatMessages(
    provider.name,
    filteredMessages,
    system_prompt,
    model,
  );

  // Append <think> tag for Qwen QwQ models
  let finalFormattedMessages = formattedMessages;
  if (modelConfig?.matchingModel?.includes("qwq")) {
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

  const parameters = mergeParametersWithDefaults({
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

  const response = await provider.getResponse(parameters, user?.id);

  return response;
}
