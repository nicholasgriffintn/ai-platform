import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";

interface DeleteChatCompletionResult {
	success: boolean;
	message: string;
}

export const handleDeleteChatCompletion = async (
	context: ServiceContext,
	completion_id: string,
): Promise<DeleteChatCompletionResult> => {
	const user = context.requireUser();

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
	});

	await conversationManager.updateConversation(completion_id, {
		archived: true,
	});

	return {
		success: true,
		message: "Conversation has been archived",
	};
};
