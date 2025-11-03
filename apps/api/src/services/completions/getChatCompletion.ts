import { ConversationManager } from "~/lib/conversationManager";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import { refreshAsyncMessages } from "~/services/completions/refreshAsyncMessages";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleGetChatCompletion = async (
	req: IRequest,
	completion_id: string,
	options?: { refreshPending?: boolean },
): Promise<Record<string, unknown>> => {
	const { env, user, context } = req;

	if (!user?.id) {
		throw new AssistantError(
			"User ID is required to get a conversation",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: serviceContext.database,
		user,
	});

	let conversation =
		await conversationManager.getConversationDetails(completion_id);

	if (options?.refreshPending) {
		const messages = (conversation.messages as any[]) || [];
		const refreshedMessages = await refreshAsyncMessages({
			conversationManager,
			conversationId: completion_id,
			env,
			user,
			messages,
		});

		conversation = {
			...conversation,
			messages: refreshedMessages,
		};
	}

	return conversation;
};
