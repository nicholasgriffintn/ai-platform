import type { UnifiedAsyncInvocation } from "~/types";
import type { ConversationManager } from "~/lib/conversationManager";
import type { Message, IEnv, IUser } from "~/types";

export interface AsyncRefreshContext {
  conversationManager: ConversationManager;
  conversationId: string;
  env: IEnv;
  user: IUser | null;
}

export type AsyncRefreshResult = {
  status: "completed" | "failed" | "in_progress";
  message: Message;
};

export type UnifiedAsyncInvocationHandler = (
  metadata: UnifiedAsyncInvocation,
  message: Message,
  context: AsyncRefreshContext,
) => Promise<AsyncRefreshResult>;

export type UnifiedAsyncInvocationHandlerMap = Record<
  string,
  UnifiedAsyncInvocationHandler
>;
