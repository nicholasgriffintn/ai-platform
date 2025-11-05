import { ConversationManager } from "~/lib/conversationManager";
import { resolveServiceContext } from "~/lib/context/serviceContext";
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
		env,
	});

	const conversation =
		await conversationManager.getConversationDetails(completion_id);

	// NOTE: refreshPending option is now deprecated. Async message polling is handled
	// automatically by the task queue system. Background tasks poll provider APIs and
	// update messages proactively, eliminating the need for manual refresh calls.
	// The option is kept for backwards compatibility but does nothing.

	return conversation;
};
