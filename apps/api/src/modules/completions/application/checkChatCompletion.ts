import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { Guardrails } from "~/infrastructure/providers/capabilities/guardrails";
import { toProviderMessages } from "~/modules/chat/application/messages/provider-mapping";
import { ConversationManager } from "~/modules/conversations/application/manager";

export const handleCheckChatCompletion = async (
  context: ServiceContext,
  completion_id: string,
  role: string,
): Promise<{
  content: string;
  data: any;
}> => {
  const user = context.requireUser();

  if (!completion_id || !role) {
    throw new AssistantError("Missing completion_id or role", ErrorType.PARAMS_ERROR);
  }

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
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
    .join("\\n");

  const roleToCheck = role || "user";

  const userSettings = await context.getUserSettings();
  const guardrails = new Guardrails(context.env, user, userSettings);
  const validation =
    roleToCheck === "user"
      ? await guardrails.validateInput(messageHistoryAsString, user.id, completion_id)
      : await guardrails.validateOutput(messageHistoryAsString, user.id, completion_id);

  return {
    content: validation.isValid
      ? `${roleToCheck === "user" ? "Input" : "Output"} is valid`
      : `${roleToCheck === "user" ? "Input" : "Output"} is not valid`,
    data: validation,
  };
};
