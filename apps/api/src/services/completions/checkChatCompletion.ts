import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import { Guardrails } from "~/lib/guardrails";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleCheckChatCompletion = async (
  req: IRequest,
  completion_id: string,
  role: string,
): Promise<{
  content: string;
  data: any;
}> => {
  const { env, user } = req;

  if (!user?.id) {
    throw new AssistantError(
      "Authentication required",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  if (!env.DB) {
    throw new AssistantError(
      "Missing DB binding",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  if (!completion_id || !role) {
    throw new AssistantError(
      "Missing completion_id or role",
      ErrorType.PARAMS_ERROR,
    );
  }

  const database = Database.getInstance(env);

  const conversationManager = ConversationManager.getInstance({
    database,
    userId: user.id,
  });

  let messages;
  try {
    messages = await conversationManager.get(completion_id);
  } catch (error) {
    throw new AssistantError(
      "Conversation not found or you don't have access to it",
      ErrorType.NOT_FOUND,
    );
  }

  if (!messages.length) {
    throw new AssistantError("No messages found", ErrorType.PARAMS_ERROR);
  }

  const messageHistoryAsString = messages
    .filter((message) => message.content && message.status !== "error")
    .map((message) => {
      return `${message.role}: ${typeof message.content === "string" ? message.content : JSON.stringify(message.content)}`;
    })
    .join("\\n");

  const roleToCheck = role || "user";

  const userSettings = await database.getUserSettings(user?.id);
  const guardrails = Guardrails.getInstance(env, user, userSettings);
  const validation =
    roleToCheck === "user"
      ? await guardrails.validateInput(
          messageHistoryAsString,
          user.id,
          completion_id,
        )
      : await guardrails.validateOutput(
          messageHistoryAsString,
          user.id,
          completion_id,
        );

  return {
    content: validation.isValid
      ? `${roleToCheck === "user" ? "Input" : "Output"} is valid`
      : `${roleToCheck === "user" ? "Input" : "Output"} is not valid`,
    data: validation,
  };
};
