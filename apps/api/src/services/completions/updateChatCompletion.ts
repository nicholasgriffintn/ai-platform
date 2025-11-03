import { ConversationManager } from "~/lib/conversationManager";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface ChatCompletionUpdateParams {
	title?: string;
	archived?: boolean;
}

export const handleUpdateChatCompletion = async (
	req: IRequest,
	completion_id: string,
	updates: ChatCompletionUpdateParams,
): Promise<Record<string, unknown>> => {
	const { env, user, context } = req;

	if (!user?.id) {
		throw new AssistantError(
			"User ID is required to update a conversation",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: serviceContext.database,
		user,
	});

	const updatedConversation = await conversationManager.updateConversation(
		completion_id,
		updates,
	);
	return updatedConversation;
};
