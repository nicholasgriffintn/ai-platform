import type { ChatRequestOptions, ChatMode } from "~/types";

interface ConversationStorageState {
	chatMode: ChatMode;
	isAuthenticated: boolean;
	isPro: boolean;
	localOnlyMode: boolean;
	settingsLocalOnly: boolean;
}

export function resolveConversationStorageMode(
	state: ConversationStorageState,
	requestOptions?: ChatRequestOptions,
) {
	const isProjectScoped = Boolean(requestOptions?.metadata?.project_id);
	const isLocalOnly =
		!state.isAuthenticated ||
		!state.isPro ||
		(!isProjectScoped &&
			(state.localOnlyMode || state.settingsLocalOnly || state.chatMode === "local"));

	return {
		isLocalOnly,
		isProjectScoped,
		shouldSyncRemote: !isLocalOnly,
	};
}
