import { ConversationManager } from "~/lib/conversationManager";
import { Database } from "~/lib/database";
import type { IEnv, Message } from "~/types";

interface GetSharedConversationRequest {
	env: IEnv;
}

export async function handleGetSharedConversation(
	{ env }: GetSharedConversationRequest,
	share_id: string,
	limit = 50,
	after?: string,
): Promise<{ messages: Message[]; share_id: string }> {
	const database = Database.getInstance(env);

	const conversationManager = ConversationManager.getInstance({
		database,
	});

	const messages = await conversationManager.getPublicConversation(
		share_id,
		limit,
		after,
	);

	return {
		messages,
		share_id,
	};
}
