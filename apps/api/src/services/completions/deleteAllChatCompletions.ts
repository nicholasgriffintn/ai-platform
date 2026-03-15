import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";

interface DeleteChatCompletionResult {
	success: boolean;
	message: string;
}

export const handleDeleteAllChatCompletions = async (
	context: ServiceContext,
): Promise<DeleteChatCompletionResult> => {
	const user = context.requireUser();

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
	});

	await conversationManager.deleteAllChatCompletions(user.id);

	return {
		success: true,
		message: "Conversations have been deleted",
	};
};
