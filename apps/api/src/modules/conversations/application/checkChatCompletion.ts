import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  Guardrails,
  type GuardrailResult,
} from "~/infrastructure/providers/capabilities/guardrails";
import { toProviderMessages } from "~/modules/chat/application/messages/provider-mapping";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { getRequestUserSettings } from "~/modules/user/application/request-settings";

export const handleCheckChatCompletion = async (
  context: ServiceContext,
  completion_id: string,
  role = "user",
): Promise<{
  content: string;
  data: GuardrailResult;
}> => {
  const user = context.requireUser();

  if (!completion_id) {
    throw new AssistantError("Missing completion_id", ErrorType.PARAMS_ERROR);
  }

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    repositories: context.repositories,
    user,
    requestCache: context.requestCache,
  });

  let messages;

  try {
    messages = await conversationManager.get(completion_id);
  } catch {
    throw new AssistantError(
      "Conversation not found or you don't have access to it",
      ErrorType.NOT_FOUND,
    );
  }

  if (!messages.length) {
    throw new AssistantError("No messages found", ErrorType.PARAMS_ERROR);
  }

  const messageHistoryAsString = toProviderMessages(messages)
    .filter((message) => message.content && message.status !== "error")
    .map((message) => {
      return `${message.role}: ${typeof message.content === "string" ? message.content : JSON.stringify(message.content)}`;
    })
    .join("\n");

  const userSettings = await getRequestUserSettings(context);
  const guardrails = new Guardrails(context.env, user, userSettings);
  const validation =
    role === "user"
      ? await guardrails.validateInput(messageHistoryAsString, user.id, completion_id)
      : await guardrails.validateOutput(messageHistoryAsString, user.id, completion_id);

  return {
    content: validation.isValid
      ? `${role === "user" ? "Input" : "Output"} is valid`
      : `${role === "user" ? "Input" : "Output"} is not valid`,
    data: validation,
  };
};
