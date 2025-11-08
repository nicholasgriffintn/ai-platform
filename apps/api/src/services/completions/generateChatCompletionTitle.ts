import { sanitiseMessages } from "~/lib/chat/utils";
import { ConversationManager } from "~/lib/conversationManager";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import { getAuxiliaryModel } from "~/lib/models";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import type { IRequest, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const handleGenerateChatCompletionTitle = async (
	req: IRequest,
	completion_id: string,
	messages?: Message[],
	store?: boolean,
): Promise<{ title: string }> => {
	const { env, user, context } = req;
	const serviceContext = resolveServiceContext({ context, env, user });
	const runtimeEnv = serviceContext.env;

	if (!runtimeEnv.AI) {
		throw new AssistantError(
			"AI binding is not available",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	if (!user || !user.id) {
		throw new AssistantError(
			"Authentication required",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	serviceContext.ensureDatabase();
	const conversationManager = ConversationManager.getInstance({
		database: serviceContext.database,
		user,
		store,
	});

	try {
		await conversationManager.get(completion_id);
	} catch {
		throw new AssistantError(
			"Conversation not found or you don't have access to it",
			ErrorType.NOT_FOUND,
		);
	}

	let messagesToUse: Message[] = [];

	const rawMessages = messages;

	if (rawMessages && rawMessages.length > 0) {
		const sanitisedMessages = sanitiseMessages(rawMessages);
		messagesToUse = sanitisedMessages.slice(0, Math.min(3, rawMessages.length));
	} else {
		const conversationMessages = await conversationManager.get(completion_id);

		if (conversationMessages.length === 0) {
			return { title: "New Conversation" };
		}

		messagesToUse = conversationMessages.map((msg) => ({
			role: msg.role,
			content: msg.content,
		}));
	}

	const prompt = `You are a title generator. Your only job is to create a short, concise title (maximum 5 words) for a conversation.
    Do not include any explanations, prefixes, or quotes in your response.
    Output only the title itself.
    
    Conversation:
    ${messagesToUse
			.map(
				(msg) =>
					`${msg.role.toUpperCase()}: ${typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)}`,
			)
			.join("\n")}
  `;

	const { model: modelToUse, provider: providerToUse } =
		await getAuxiliaryModel(runtimeEnv, user);
	const provider = getChatProvider(providerToUse, { env: runtimeEnv, user });
	const response: any = await provider.getResponse({
		env: runtimeEnv!,
		model: modelToUse,
		messages: [{ role: "user", content: prompt }],
		user: user,
	} as any);

	let newTitle = response.response.trim();

	if (
		(newTitle.startsWith('"') && newTitle.endsWith('"')) ||
		(newTitle.startsWith("'") && newTitle.endsWith("'"))
	) {
		newTitle = newTitle.slice(1, -1);
	}

	if (newTitle.length > 50) {
		newTitle = `${newTitle.substring(0, 47)}...`;
	}

	if (!newTitle) {
		newTitle = "New Conversation";
	}

	await conversationManager.updateConversation(completion_id, {
		title: newTitle,
	});

	return { title: newTitle };
};
