import type { HomeChatModeId, SandboxChatModeSettings } from "@assistant/schemas";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiKeyService } from "~/lib/api/api-key";
import { createConversationId } from "~/lib/conversations";
import type { ChatMode, ChatSettings } from "~/types";

const defaultSettings: ChatSettings = {
	temperature: 0.7,
	top_p: 0.8,
	max_tokens: 1024 * 8,
	presence_penalty: 0,
	frequency_penalty: 0,
	use_rag: false,
	enabled_tools: [],
	rag_options: {
		topK: 3,
		scoreThreshold: 0.5,
		includeMetadata: false,
		namespace: "",
	},
};

export interface ChatStore {
	currentConversationId: string | undefined;
	setCurrentConversationId: (id: string | undefined) => void;
	startNewConversation: (id?: string) => void;
	clearCurrentConversation: () => void;

	hasApiKey: boolean;
	setHasApiKey: (hasApiKey: boolean) => void;
	isAuthenticated: boolean;
	setIsAuthenticated: (isAuthenticated: boolean) => void;
	isAuthenticationLoading: boolean;
	setIsAuthenticationLoading: (isAuthenticationLoading: boolean) => void;
	isPro: boolean;
	setIsPro: (isPro: boolean) => void;

	localOnlyMode: boolean;
	setLocalOnlyMode: (localOnly: boolean) => void;
	chatMode: ChatMode;
	setChatMode: (mode: ChatMode) => void;
	homeChatMode: HomeChatModeId;
	setHomeChatMode: (mode: HomeChatModeId) => void;
	sandboxModeSettings: SandboxChatModeSettings;
	setSandboxModeSettings: (settings: SandboxChatModeSettings) => void;
	model: string | null;
	setModel: (model: string | null) => void;
	useMultiModel: boolean;
	setUseMultiModel: (useMultiModel: boolean) => void;
	selectedAgentId: string | null;
	setSelectedAgentId: (agentId: string | null) => void;
	chatSettings: ChatSettings;
	setChatSettings: (settings: ChatSettings) => void;
	showSearch: boolean;
	setShowSearch: (showSearch: boolean) => void;
	chatInput: string;
	setChatInput: (query: string) => void;

	initializeStore: (completionId?: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>()(
	persist(
		(set, get) => ({
			currentConversationId: undefined,
			setCurrentConversationId: (id) => set({ currentConversationId: id }),
			startNewConversation: (id?: string) =>
				set({ currentConversationId: id || createConversationId() }),
			clearCurrentConversation: () => set({ currentConversationId: undefined }),

			hasApiKey: false,
			setHasApiKey: (hasApiKey) => set({ hasApiKey }),
			isAuthenticated: false,
			setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
			isAuthenticationLoading: true,
			setIsAuthenticationLoading: (isAuthenticationLoading) => set({ isAuthenticationLoading }),
			isPro: false,
			setIsPro: (isPro) => set({ isPro }),

			localOnlyMode: false,
			setLocalOnlyMode: (localOnly) => set({ localOnlyMode: localOnly }),
			chatMode: "remote" as ChatMode,
			setChatMode: (mode) => set({ chatMode: mode }),
			homeChatMode: "chat",
			setHomeChatMode: (mode) => set({ homeChatMode: mode }),
			sandboxModeSettings: {},
			setSandboxModeSettings: (settings) => set({ sandboxModeSettings: settings }),
			model: null,
			setModel: (model) => set({ model }),
			useMultiModel: false,
			setUseMultiModel: (useMultiModel) => set({ useMultiModel }),
			selectedAgentId: null,
			setSelectedAgentId: (agentId) => set({ selectedAgentId: agentId }),
			chatSettings: defaultSettings,
			setChatSettings: (settings) => set({ chatSettings: settings }),
			chatInput: "",
			setChatInput: (query) => set({ chatInput: query }),
			showSearch: false,
			setShowSearch: (showSearch) => set({ showSearch }),

			initializeStore: async (completionId?: string) => {
				const apiKey = await apiKeyService.getApiKey();
				set({ hasApiKey: !!apiKey });

				const localOnlyMode = window.localStorage.getItem("localOnlyMode") === "true";
				set({ localOnlyMode });

				const checkAuthAndSetConversation = async () => {
					if (completionId) {
						let attempts = 0;
						const maxAttempts = 100;

						const trySetConversation = () => {
							attempts++;
							if (attempts > maxAttempts) {
								console.warn(
									"Timed out waiting for authentication to complete so did not set conversation ID",
								);
								return;
							}

							if (get().isAuthenticationLoading) {
								setTimeout(trySetConversation, 100);
								return;
							}

							set({ currentConversationId: completionId });
						};

						trySetConversation();
					}
				};

				checkAuthAndSetConversation();
			},
		}),
		{
			name: "chat-store",
			partialize: (state) => ({
				localOnlyMode: state.localOnlyMode,
				chatMode: state.chatMode,
				homeChatMode: state.homeChatMode,
				sandboxModeSettings: state.sandboxModeSettings,
				model: state.model,
				useMultiModel: state.useMultiModel,
				chatSettings: state.chatSettings,
				selectedAgentId: state.selectedAgentId,
			}),
		},
	),
);
