import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
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

export type AsyncInvocationHandler = (
  metadata: AsyncInvocationMetadata,
  message: Message,
  context: AsyncRefreshContext,
) => Promise<AsyncRefreshResult>;

export type AsyncInvocationHandlerMap = Record<
  string,
  AsyncInvocationHandler
>;
