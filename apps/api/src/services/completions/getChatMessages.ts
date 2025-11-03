import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { AnonymousUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleGetChatMessages = async (
	context: ServiceContext,
	anonymousUser: AnonymousUser | null,
	completion_id: string,
	limit?: number,
	after?: string,
): Promise<{ messages: any[]; conversation_id: string }> => {
	const user = context.user ?? null;

	if (!user?.id) {
		throw new AssistantError(
			"User ID is required to get messages",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
		anonymousUser,
	});

	const messages = await conversationManager.get(
		completion_id,
		undefined,
		limit || 50,
		after,
	);

	return {
		messages,
		conversation_id: completion_id,
	};
};

export const handleGetChatMessageById = async (
	context: ServiceContext,
	anonymousUser: AnonymousUser | null,
	message_id: string,
): Promise<{ message: any; conversation_id: string }> => {
	const user = context.user ?? null;

	if (!user?.id) {
		throw new AssistantError(
			"User ID is required to get a message",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
		anonymousUser,
	});

	const result = await conversationManager.getMessageById(message_id);

	return result;
};
