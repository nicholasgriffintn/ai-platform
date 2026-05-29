import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { cloneMessagesForBranch } from "~/lib/chat/branchMessages";
import type { Message } from "~/types";

interface ChatCompletionUpdateParams {
	title?: string;
	archived?: boolean;
	messages?: Message[];
	parent_conversation_id?: string;
	parent_message_id?: string;
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

	const { messages, parent_conversation_id, parent_message_id, ...conversationUpdates } = updates;
	const hasConversationUpdates = Object.values(conversationUpdates).some(
		(value) => value !== undefined,
	);
	const branchMetadata =
		parent_conversation_id && parent_message_id
			? {
					branch_of: JSON.stringify({
						conversation_id: parent_conversation_id,
						message_id: parent_message_id,
					}),
				}
			: undefined;

	let updatedConversation: Record<string, unknown> = {};

	if (messages) {
		if (branchMetadata) {
			await conversationManager.replaceMessages(completion_id, cloneMessagesForBranch(messages), {
				metadata: branchMetadata,
			});
		} else {
			await conversationManager.replaceMessages(completion_id, messages);
		}
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
