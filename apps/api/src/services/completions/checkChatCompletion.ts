import { ConversationManager } from "~/lib/conversationManager";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import { Guardrails } from "~/lib/guardrails";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleCheckChatCompletion = async (
	req: IRequest,
	completion_id: string,
	role: string,
): Promise<{
	content: string;
	data: any;
}> => {
	const { env, user, context } = req;

	if (!user?.id) {
		throw new AssistantError(
			"Authentication required",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	if (!completion_id || !role) {
		throw new AssistantError(
			"Missing completion_id or role",
			ErrorType.PARAMS_ERROR,
		);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: serviceContext.database,
		user,
	});

	let messages;
	try {
		messages = await conversationManager.get(completion_id);
	} catch {
		throw new AssistantError(
			"Conversation not found or you don't have access to it",
			ErrorType.NOT_FOUND,
		);
	}

	if (!messages.length) {
		throw new AssistantError("No messages found", ErrorType.PARAMS_ERROR);
	}

	const messageHistoryAsString = messages
		.filter((message) => message.content && message.status !== "error")
		.map((message) => {
			return `${message.role}: ${typeof message.content === "string" ? message.content : JSON.stringify(message.content)}`;
		})
		.join("\\n");

	const roleToCheck = role || "user";

	const userSettings = await serviceContext.repositories.userSettings.getUserSettings(user?.id);
	const guardrails = new Guardrails(serviceContext.env, user, userSettings);
	const validation =
		roleToCheck === "user"
			? await guardrails.validateInput(
					messageHistoryAsString,
					user.id,
					completion_id,
				)
			: await guardrails.validateOutput(
					messageHistoryAsString,
					user.id,
					completion_id,
				);

	return {
		content: validation.isValid
			? `${roleToCheck === "user" ? "Input" : "Output"} is valid`
			: `${roleToCheck === "user" ? "Input" : "Output"} is not valid`,
		data: validation,
	};
};
