import { ConversationManager } from "~/lib/conversationManager";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleGetChatCompletion = async (
	req: IRequest,
	completion_id: string,
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

	return await conversationManager.getConversationDetails(completion_id);
};
