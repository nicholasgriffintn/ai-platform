import { ConversationManager } from "../../lib/conversationManager";
import type { IRequest } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";

interface DeleteChatCompletionResult {
	success: boolean;
	message: string;
}

export const handleDeleteChatCompletion = async (
	req: IRequest,
	completion_id: string,
): Promise<DeleteChatCompletionResult> => {
	const { env, user } = req;

	if (!user?.id) {
		throw new AssistantError(
			"User ID is required to delete a conversation",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	if (!env.DB) {
		throw new AssistantError(
			"Missing database connection",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const conversationManager = ConversationManager.getInstance({
		database: env.DB,
		userId: user.id,
	});

	await conversationManager.updateConversation(completion_id, {
		archived: true,
	});

	return {
		success: true,
		message: "Conversation has been archived",
	};
};
