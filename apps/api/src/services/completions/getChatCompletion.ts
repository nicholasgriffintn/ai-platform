import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";

export const handleGetChatCompletion = async (
	context: ServiceContext,
	completion_id: string,
): Promise<Record<string, unknown>> => {
	const user = context.requireUser();

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
		env: context.env,
	});

	return await conversationManager.getConversationDetails(completion_id);
};
