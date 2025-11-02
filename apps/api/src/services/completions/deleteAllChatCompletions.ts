import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface DeleteChatCompletionResult {
	success: boolean;
	message: string;
}

export const handleDeleteAllChatCompletions = async (
	req: IRequest,
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

	const database = Database.getInstance(env);

	const conversationManager = ConversationManager.getInstance({
		database,
		user,
	});

	await conversationManager.deleteAllChatCompletions(user?.id);

	return {
		success: true,
		message: "Conversations have been deleted",
	};
};
