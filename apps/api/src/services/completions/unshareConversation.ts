import { ConversationManager } from "~/lib/conversationManager";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface UnshareConversationRequest {
	env: IEnv;
	user: User;
	context?: ServiceContext;
}

export async function handleUnshareConversation(
	{ env, user, context }: UnshareConversationRequest,
	completion_id: string,
): Promise<{ success: boolean }> {
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

	await conversationManager.unshareConversation(completion_id);

	return {
		success: true,
	};
}
