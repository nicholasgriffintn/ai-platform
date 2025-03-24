import { AIProviderFactory } from "~/providers/factory";
import type { ChatCompletionParameters, Message } from "~/types";
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
    throw new Error("Model is required");
  }

  const modelConfig = getModelConfigByMatchingModel(model);
  const provider = AIProviderFactory.getProvider(
    modelConfig?.provider || "workers-ai",
  );

  const filteredMessages =
    mode === "normal"
      ? messages.filter((msg: Message) => !msg.mode || msg.mode === "normal")
      : messages;

  console.log({
    location: "getAIResponse",
    provider: provider.name,
  });

  const formattedMessages = formatMessages(
    provider.name,
    filteredMessages,
    system_prompt,
    model,
  );

  let shouldStream = false;
  const modelTypeIsText = modelConfig?.type?.includes("text");
  if (params.stream && provider.supportsStreaming && modelTypeIsText) {
    shouldStream = true;
  }

  const parameters = mergeParametersWithDefaults({
    ...params,
    model,
    messages: formattedMessages,
    message,
    mode,
    app_url,
    system_prompt,
    env,
    user,
    stream: shouldStream,
    enabled_tools,
  });

  const response = await provider.getResponse(parameters);

  return response;
}
