import {
	conversationModeMetadataSchema,
	type ConversationModeMetadata,
	type HomeChatModeId,
} from "@ngriffin_uk/polychat-schemas";

import type { ChatRequestOptions, Conversation } from "~/types";

export function buildConversationModeMetadata(params: {
	mode: HomeChatModeId;
	requestOptions?: ChatRequestOptions;
}): ConversationModeMetadata | undefined {
	const { mode, requestOptions } = params;
	if (mode === "chat") {
		return { mode };
	}

	const parsed = conversationModeMetadataSchema.safeParse({
		mode,
		requestOptions: mode === "background" ? undefined : requestOptions?.options,
		smsSettings:
			mode === "sms" && requestOptions?.options?.sms?.enabled
				? {
						from: requestOptions.options.sms.from,
						to: requestOptions.options.sms.to,
					}
				: undefined,
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
