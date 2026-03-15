import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";

export async function handleUnshareConversation(
	context: ServiceContext,
	completion_id: string,
): Promise<{ success: boolean }> {
	const user = context.requireUser();

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
	});

	await conversationManager.unshareConversation(completion_id);

	return {
		success: true,
	};
}
