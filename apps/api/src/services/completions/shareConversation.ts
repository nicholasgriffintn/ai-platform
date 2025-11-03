import { ConversationManager } from "~/lib/conversationManager";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface ShareConversationRequest {
	env: IEnv;
	user: User;
	context?: ServiceContext;
}

export async function handleShareConversation(
	{ env, user, context }: ShareConversationRequest,
	completion_id: string,
): Promise<{ share_id: string }> {
	if (!user || !user.id) {
		throw new AssistantError(
			"Authentication required",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: serviceContext.database,
		user,
	});

	const result = await conversationManager.shareConversation(completion_id);

	return {
		share_id: result.share_id,
	};
}
