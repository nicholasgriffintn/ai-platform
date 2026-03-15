import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";

interface ListChatCompletionsOptions {
	limit?: number;
	page?: number;
	includeArchived?: boolean;
}

export const handleListChatCompletions = async (
	context: ServiceContext,
	options: ListChatCompletionsOptions = {},
): Promise<{
	conversations: Record<string, unknown>[];
	totalPages: number;
	pageNumber: number;
	pageSize: number;
}> => {
	const { limit = 25, page = 1, includeArchived = false } = options;

	const user = context.requireUser();

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
	});

	return await conversationManager.list(limit, page, includeArchived);
};
