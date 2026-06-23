import { ConversationManager, type ConversationListOptions } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";

export const handleListChatCompletions = async (
	context: ServiceContext,
	options: ConversationListOptions = {},
): Promise<{
	conversations: Record<string, unknown>[];
	totalPages: number;
	pageNumber: number;
	pageSize: number;
}> => {
	const user = context.requireUser();

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
	});

	return await conversationManager.list(options);
};
