import { ConversationManager } from "~/lib/conversationManager";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface DeleteChatCompletionResult {
	success: boolean;
	message: string;
}

export const handleDeleteAllChatCompletions = async (
	req: IRequest,
): Promise<DeleteChatCompletionResult> => {
	const { env, user, context } = req;

	if (!user?.id) {
		throw new AssistantError(
			"User ID is required to delete a conversation",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: serviceContext.database,
		user,
	});

	await conversationManager.deleteAllChatCompletions(user?.id);

	return {
		success: true,
		message: "Conversations have been deleted",
	};
};
