import { ConversationManager } from "~/lib/conversationManager";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface ListChatCompletionsOptions {
	limit?: number;
	page?: number;
	includeArchived?: boolean;
}

export const handleListChatCompletions = async (
	req: IRequest,
	options: ListChatCompletionsOptions = {},
): Promise<{
	conversations: Record<string, unknown>[];
	totalPages: number;
	pageNumber: number;
	pageSize: number;
}> => {
	const { env, user, context } = req;
	const { limit = 25, page = 1, includeArchived = false } = options;

	if (!user?.id) {
		throw new AssistantError(
			"User ID is required to list conversations",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: serviceContext.database,
		user,
	});

	return await conversationManager.list(limit, page, includeArchived);
};
