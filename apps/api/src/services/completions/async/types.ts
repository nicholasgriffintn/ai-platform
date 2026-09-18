import type { AsyncInvocationMetadata } from "@ngriffin_uk/polychat-ai-providers";

import type { ConversationManager } from "~/services/conversations/manager";
import type { Message, IEnv, IUser } from "~/types";

export interface AsyncRefreshContext {
  conversationManager: Pick<ConversationManager, "update">;
  conversationId: string;
  env: IEnv;
  user: IUser | null;
}

export type AsyncRefreshResultStatus = "completed" | "failed" | "in_progress";

export type AsyncRefreshResult = {
  status: AsyncRefreshResultStatus;
  message: Message;
};

export type AsyncInvocationHandler = (
  metadata: AsyncInvocationMetadata,
  message: Message,
  context: AsyncRefreshContext,
) => Promise<AsyncRefreshResult>;
