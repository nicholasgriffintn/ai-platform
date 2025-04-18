import { AIProviderFactory } from "~/providers/factory";
import type { ChatCompletionParameters, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { formatMessages } from "~/utils/messages";
import { getModelConfigByMatchingModel } from "../models";
import { mergeParametersWithDefaults } from "./parameters";

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
  if (params.stream && provider.supportsStreaming && modelTypeIsText) {
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
  });

  const response = await provider.getResponse(parameters, user?.id);

  return response;
}
