import { ConversationManager } from "../../lib/conversationManager";
import { Database } from "../../lib/database";
import type { IEnv, User } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";

interface ShareConversationRequest {
  env: IEnv;
  user: User;
}

export async function handleShareConversation(
  { env, user }: ShareConversationRequest,
  completion_id: string,
): Promise<{ share_id: string }> {
  if (!user || !user.id) {
    throw new AssistantError(
      "Authentication required",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const database = Database.getInstance(env);

  const conversationManager = ConversationManager.getInstance({
    database,
    userId: user.id,
  });

  const result = await conversationManager.shareConversation(completion_id);

  return {
    share_id: result.share_id,
  };
}
