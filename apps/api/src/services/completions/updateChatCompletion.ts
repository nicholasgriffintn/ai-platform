import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Message } from "~/types";

interface ChatCompletionUpdateParams {
	title?: string;
	archived?: boolean;
	messages?: Message[];
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

	const { messages, ...conversationUpdates } = updates;
	const hasConversationUpdates = Object.values(conversationUpdates).some(
		(value) => value !== undefined,
	);

	let updatedConversation: Record<string, unknown> = {};

	if (messages) {
		await conversationManager.replaceMessages(completion_id, messages);
		updatedConversation = await conversationManager.getConversationDetails(completion_id);
	}

	if (hasConversationUpdates) {
		updatedConversation = await conversationManager.updateConversation(
			completion_id,
			conversationUpdates,
		);
	}

	if (messages) {
		updatedConversation = await conversationManager.getConversationDetails(completion_id);
	}

	return updatedConversation;
};
