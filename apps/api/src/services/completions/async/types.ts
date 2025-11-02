import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import type { ConversationManager } from "~/lib/conversationManager";
import type { Message, IEnv, IUser } from "~/types";

export interface AsyncRefreshContext {
	conversationManager: ConversationManager;
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
