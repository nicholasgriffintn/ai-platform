import { requestTurnCancellation } from "~/lib/chat/turn-cancellation";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { AssistantError, ErrorType } from "~/utils/errors";

export type CancelChatCompletionContext = Pick<
  ServiceContext,
  "database" | "ensureDatabase" | "env" | "requestCache" | "requireUser"
>;

export async function handleCancelChatCompletion(
  context: CancelChatCompletionContext,
  completion_id: string,
): Promise<{ cancelled: true; completion_id: string }> {
  const user = context.requireUser();

  if (!completion_id) {
    throw new AssistantError("Missing completion_id", ErrorType.PARAMS_ERROR);
  }

  context.ensureDatabase();

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
    requestCache: context.requestCache,
  });

  try {
    await conversationManager.get(completion_id);
  } catch {
    throw new AssistantError(
      "Conversation not found or you don't have access to it",
      ErrorType.NOT_FOUND,
    );
  }

  await requestTurnCancellation(context.env, completion_id);

  return { cancelled: true, completion_id };
}
