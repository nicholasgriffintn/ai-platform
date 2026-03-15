import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";

export async function handleShareConversation(
	context: ServiceContext,
	completion_id: string,
): Promise<{ share_id: string }> {
	const user = context.requireUser();

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
	});

	const result = await conversationManager.shareConversation(completion_id);

	return {
		share_id: result.share_id,
	};
}
