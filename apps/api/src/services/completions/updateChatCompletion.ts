import { canReplaceStoredConversationMessages } from "@assistant/schemas";
import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { cloneMessagesForBranch, selectBranchSourceMessages } from "~/lib/chat/branchMessages";
import type { Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

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
			let branchSourceMessages = messages;
			try {
				const parentActiveMessages = await conversationManager.get(parent_conversation_id);
				branchSourceMessages = selectBranchSourceMessages({
					parentActiveMessages,
					parentMessageId: parent_message_id,
					providedMessages: messages,
				});
			} catch {
				branchSourceMessages = messages;
			}

			if (!canReplaceStoredConversationMessages(branchSourceMessages)) {
				throw new AssistantError(
					"Compacted visible history cannot be used to create a stored branch",
					ErrorType.PARAMS_ERROR,
					400,
				);
			}

			await conversationManager.replaceMessages(
				completion_id,
				cloneMessagesForBranch(branchSourceMessages, completion_id),
				{
					metadata: branchMetadata,
				},
			);
		} else {
			if (!canReplaceStoredConversationMessages(messages)) {
				throw new AssistantError(
					"Compacted visible history cannot replace stored conversation messages",
					ErrorType.PARAMS_ERROR,
					400,
				);
			}

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
