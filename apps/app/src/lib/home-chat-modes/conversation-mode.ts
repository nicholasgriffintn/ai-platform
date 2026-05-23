import {
	conversationModeMetadataSchema,
	type ConversationModeMetadata,
	type HomeChatModeId,
	type SandboxChatModeSettings,
} from "@assistant/schemas";

import type { ChatRequestOptions, Conversation } from "~/types";

export function buildConversationModeMetadata(params: {
	mode: HomeChatModeId;
	requestOptions?: ChatRequestOptions;
	sandboxSettings?: SandboxChatModeSettings;
}): ConversationModeMetadata | undefined {
	const { mode, requestOptions, sandboxSettings } = params;
	if (mode === "chat") {
		return { mode };
	}

	const parsed = conversationModeMetadataSchema.safeParse({
		mode,
		requestOptions,
		sandboxSettings: mode === "sandbox" ? sandboxSettings : undefined,
	});

	return parsed.success ? parsed.data : undefined;
}

export function getConversationModeMetadata(
	conversation: Conversation | null | undefined,
): ConversationModeMetadata | null {
	for (const message of conversation?.messages ?? []) {
		const parsed = conversationModeMetadataSchema.safeParse(message.data?.conversationMode);
		if (parsed.success) {
			return parsed.data;
		}
	}

	return null;
}
