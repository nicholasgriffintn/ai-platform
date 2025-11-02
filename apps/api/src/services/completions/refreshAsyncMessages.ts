import type { ConversationManager } from "~/lib/conversationManager";
import { isAsyncInvocationPending } from "~/lib/async/asyncInvocation";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import type { IEnv, Message, IUser } from "~/types";
import { getLogger } from "~/utils/logger";
import { handleAsyncInvocation } from "./async/handler";
import type { AsyncRefreshContext } from "./async/types";

const logger = getLogger({
	prefix: "services/completions/refreshAsyncMessages",
});

const ASYNC_STATUS_PENDING = "in_progress";

function createContext(
	conversationManager: ConversationManager,
	conversationId: string,
	env: IEnv,
	user: IUser | null,
): AsyncRefreshContext {
	return {
		conversationManager,
		conversationId,
		env,
		user,
	};
}

function shouldPollMessage(
	message: Message,
	metadata?: AsyncInvocationMetadata,
): boolean {
	if (!metadata?.provider) {
		return false;
	}

	if (message.status === ASYNC_STATUS_PENDING) {
		return true;
	}

	return isAsyncInvocationPending(metadata);
}

export async function refreshAsyncMessages({
	conversationManager,
	conversationId,
	env,
	user,
	messages,
}: {
	conversationManager: ConversationManager;
	conversationId: string;
	env: IEnv;
	user: IUser | null;
	messages: Message[];
}): Promise<Message[]> {
	if (!messages.length) {
		return messages;
	}

	const context = createContext(conversationManager, conversationId, env, user);
	const updatedMessages = [...messages];
	let hasChanges = false;

	for (const [index, message] of messages.entries()) {
		const asyncInvocation = (message.data as Record<string, any> | undefined)
			?.asyncInvocation as AsyncInvocationMetadata | undefined;

		if (!asyncInvocation || !shouldPollMessage(message, asyncInvocation)) {
			continue;
		}

		try {
			const result = await handleAsyncInvocation(
				asyncInvocation,
				message,
				context,
			);

			if (result.message !== message) {
				updatedMessages[index] = result.message;
				hasChanges = true;
			}
		} catch (error) {
			logger.error("Failed to refresh async invocation", {
				error,
				provider: asyncInvocation.provider,
				id: asyncInvocation.id,
				type: asyncInvocation.type,
			});
		}
	}

	return hasChanges ? updatedMessages : messages;
}
