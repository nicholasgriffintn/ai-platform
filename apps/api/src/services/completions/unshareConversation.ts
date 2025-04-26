import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import type { IEnv, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface UnshareConversationRequest {
  env: IEnv;
  user: User;
}

export async function handleUnshareConversation(
  { env, user }: UnshareConversationRequest,
  completion_id: string,
): Promise<{ success: boolean }> {
  if (!user || !user.id) {
    throw new AssistantError(
      "Authentication required",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const database = Database.getInstance(env);

  const conversationManager = ConversationManager.getInstance({
    database,
    user,
  });

  await conversationManager.unshareConversation(completion_id);

  return {
    success: true,
  };
}
