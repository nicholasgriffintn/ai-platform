import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Message } from "~/types";

export async function handleGetSharedConversation(
	context: ServiceContext,
	share_id: string,
	limit = 50,
	after?: string,
): Promise<{ messages: Message[]; share_id: string }> {
	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		env: context.env,
	});

	const messages = await conversationManager.getPublicConversation(share_id, limit, after, {
		includeArchived: true,
	});

	return {
		messages,
		share_id,
	};
}
