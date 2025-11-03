import { ConversationManager } from "~/lib/conversationManager";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, Message } from "~/types";

interface GetSharedConversationRequest {
	env: IEnv;
	context?: ServiceContext;
}

export async function handleGetSharedConversation(
	{ env, context }: GetSharedConversationRequest,
	share_id: string,
	limit = 50,
	after?: string,
): Promise<{ messages: Message[]; share_id: string }> {
	const serviceContext = resolveServiceContext({ context, env });
	serviceContext.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: serviceContext.database,
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
