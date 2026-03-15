import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";

interface ChatCompletionUpdateParams {
	title?: string;
	archived?: boolean;
}

export const handleUpdateChatCompletion = async (
	context: ServiceContext,
	completion_id: string,
	updates: ChatCompletionUpdateParams,
): Promise<Record<string, unknown>> => {
	const user = context.requireUser();

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
	});

	const updatedConversation = await conversationManager.updateConversation(
		completion_id,
		updates,
	);
	return updatedConversation;
};
