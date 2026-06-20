import type { Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const DEFAULT_RECIPE_CONTEXT_MESSAGE_LIMIT = 6;
const RECIPE_CONTEXT_ROLES = new Set(["user", "assistant"]);

interface RecipeConversationReader {
	get(conversationId: string, message?: Message, limit?: number): Promise<Message[]>;
}

function isRecipeContextMessage(message: Message): boolean {
	if (!RECIPE_CONTEXT_ROLES.has(message.role)) {
		return false;
	}
	if (
		message.role === "assistant" &&
		Array.isArray(message.tool_calls) &&
		message.tool_calls.length > 0
	) {
		return false;
	}
	return true;
}

export async function getRecipeConversationContext(params: {
	conversationManager?: RecipeConversationReader;
	conversationId?: string;
	limit?: number;
}): Promise<Message[]> {
	if (!params.conversationManager || !params.conversationId) {
		return [];
	}

	try {
		const messages = await params.conversationManager.get(
			params.conversationId,
			undefined,
			params.limit ?? DEFAULT_RECIPE_CONTEXT_MESSAGE_LIMIT * 2,
		);
		return messages
			.filter(isRecipeContextMessage)
			.slice(-(params.limit ?? DEFAULT_RECIPE_CONTEXT_MESSAGE_LIMIT));
	} catch (error) {
		if (error instanceof AssistantError && error.type === ErrorType.NOT_FOUND) {
			return [];
		}
		throw error;
	}
}
