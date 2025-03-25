import { ConversationManager } from "../../lib/conversationManager";
import type { IEnv, User } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";

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

  const conversationManager = ConversationManager.getInstance({
    database: env.DB,
    userId: user.id,
  });

  await conversationManager.unshareConversation(completion_id);

  return {
    success: true,
  };
}
