import type { ChatMode, Message } from "../../types";
import type { ConversationManager } from "../conversationManager";

export const processPromptCoachMode = async (
  options: {
    mode: ChatMode;
    userMessage: string;
    completion_id: string;
  },
  conversationManager: ConversationManager,
): Promise<{
  userMessage: string;
  currentMode: ChatMode;
  additionalMessages: Message[];
}> => {
  if (!options || !conversationManager) {
    throw new Error(
      "Invalid input: options and conversationManager are required",
    );
  }

  const modeWithFallback = options.mode || "normal";

  const isNoSystemMode = modeWithFallback === "no_system";
  const isNotPromptCoachMode =
    modeWithFallback !== "prompt_coach" ||
    (typeof options.userMessage === "string" &&
      options.userMessage.toLowerCase() !== "use this prompt");

  if (isNoSystemMode || isNotPromptCoachMode) {
    return {
      userMessage: options.userMessage,
      currentMode: modeWithFallback,
      additionalMessages: [],
    };
  }

  const messageHistory = await conversationManager.get(options.completion_id);
  const lastAssistantMessage = messageHistory
    .slice()
    .reverse()
    .find((msg) => msg.role === "assistant")?.content;

  if (!lastAssistantMessage || typeof lastAssistantMessage !== "string") {
    return {
      userMessage: options.userMessage,
      currentMode: modeWithFallback,
      additionalMessages: [],
    };
  }

  const promptRegex =
    /<revised_prompt>([\s\S]*?)(?=<\/revised_prompt>|suggestions|questions)/i;
  const match = promptRegex.exec(lastAssistantMessage);

  if (!match) {
    return {
      userMessage: options.userMessage,
      currentMode: modeWithFallback,
      additionalMessages: [],
    };
  }

  const userMessage = match[1].trim();
  await conversationManager.add(options.completion_id, {
    role: "user",
    content: userMessage,
    mode: "normal",
  });

  return {
    userMessage,
    currentMode: "normal",
    additionalMessages: [{ role: "assistant", content: userMessage }],
  };
};
