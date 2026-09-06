import { migrateChatStore } from "@ngriffin_uk/polychat-library-chat";
import type { ChatSettings } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { apiKeyService } from "@ngriffin_uk/polychat-library-client";
import type {
  AssistantActionSelection,
  ChatMode,
  HomeChatModeId,
  ModelTier,
} from "@ngriffin_uk/polychat-schemas";
import type { User, UserSettings } from "@ngriffin_uk/polychat-schemas/user-profile";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const defaultSettings: ChatSettings = {
  enabled_tools: [],
  tool_options: {
    shell: {
      environment: {
        type: "container_auto",
      },
    },
  },
};

export interface ChatStore {
  currentConversationId: string | undefined;
  locallyCreatedConversationIds: Record<string, true>;
  isComposingGoal: boolean;
  setCurrentConversationId: (id: string | undefined) => void;
  startNewConversation: (id?: string) => string;
  markConversationLocallyCreated: (id: string) => void;
  markConversationRemoteAvailable: (id: string) => void;
  clearCurrentConversation: () => void;
  setComposingGoal: (composing: boolean) => void;

  hasApiKey: boolean;
  setHasApiKey: (hasApiKey: boolean) => void;
  user: User | null;
  userSettings: UserSettings | null;
  hasHydratedUserConfiguration: boolean;
  isAuthenticated: boolean;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  isAuthenticationLoading: boolean;
  setIsAuthenticationLoading: (isAuthenticationLoading: boolean) => void;
  isPro: boolean;
  setIsPro: (isPro: boolean) => void;

  localOnlyMode: boolean;
  setLocalOnlyMode: (localOnly: boolean) => void;
  temporaryChatsDefault: boolean;
  setTemporaryChatsDefault: (temporaryChatsDefault: boolean) => void;
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
  homeChatMode: HomeChatModeId;
  setHomeChatMode: (mode: HomeChatModeId) => void;
  model: string | null;
  setModel: (model: string | null) => void;
  modelTier: ModelTier | null;
  setModelTier: (tier: ModelTier | null) => void;
  useMultiModel: boolean;
  setUseMultiModel: (useMultiModel: boolean) => void;
  selectedTeammateId: string | null;
  setSelectedTeammateId: (teammateId: string | null) => void;
  selectedTeammateTokenPosition: number | null;
  setSelectedTeammateTokenPosition: (position: number | null) => void;
  selectedAssistantAction: AssistantActionSelection | null;
  setSelectedAssistantAction: (action: ChatStore["selectedAssistantAction"]) => void;
  chatSettings: ChatSettings;
  setChatSettings: (settings: ChatSettings) => void;
  showSearch: boolean;
  setShowSearch: (showSearch: boolean) => void;
  chatInput: string;
  setChatInput: (query: string) => void;

  setAuthenticatedUserConfiguration: (configuration: {
    hasApiKey: boolean;
    user: User | null;
    userSettings: UserSettings | null;
  }) => void;
  setUserSettings: (settings: UserSettings | null) => void;
  clearAuthenticatedUserConfiguration: () => void;
  initializeStore: (completionId?: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      currentConversationId: undefined,
      locallyCreatedConversationIds: {},
      isComposingGoal: false,
      setCurrentConversationId: (id) => set({ currentConversationId: id, isComposingGoal: false }),
      setComposingGoal: (composing) => set({ isComposingGoal: composing }),
      startNewConversation: (id?: string) => {
        const conversationId = id || generateId();

        set((state) => ({
          currentConversationId: conversationId,
          locallyCreatedConversationIds: {
            ...state.locallyCreatedConversationIds,
            [conversationId]: true,
          },
        }));

        return conversationId;
      },
      markConversationLocallyCreated: (id: string) =>
        set((state) => ({
          locallyCreatedConversationIds: { ...state.locallyCreatedConversationIds, [id]: true },
        })),
      markConversationRemoteAvailable: (id: string) =>
        set((state) => {
          if (!state.locallyCreatedConversationIds[id]) {
            return {};
          }

          const { [id]: _removed, ...remainingIds } = state.locallyCreatedConversationIds;

          return { locallyCreatedConversationIds: remainingIds };
        }),
      clearCurrentConversation: () =>
        set({ currentConversationId: undefined, isComposingGoal: false }),

      hasApiKey: false,
      setHasApiKey: (hasApiKey) => set({ hasApiKey }),
      user: null,
      userSettings: null,
      hasHydratedUserConfiguration: false,
      isAuthenticated: false,
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      isAuthenticationLoading: true,
      setIsAuthenticationLoading: (isAuthenticationLoading) => set({ isAuthenticationLoading }),
      isPro: false,
      setIsPro: (isPro) => set({ isPro }),

      localOnlyMode: false,
      setLocalOnlyMode: (localOnly) => set({ localOnlyMode: localOnly }),
      temporaryChatsDefault: false,
      setTemporaryChatsDefault: (temporaryChatsDefault) => set({ temporaryChatsDefault }),
      chatMode: "remote" as ChatMode,
      setChatMode: (mode) => set({ chatMode: mode }),
      homeChatMode: "chat",
      setHomeChatMode: (mode) => set({ homeChatMode: mode }),
      model: null,
      setModel: (model) => set({ model }),
      modelTier: null,
      setModelTier: (modelTier) => set({ modelTier }),
      useMultiModel: false,
      setUseMultiModel: (useMultiModel) => set({ useMultiModel }),
      selectedTeammateId: null,
      setSelectedTeammateId: (teammateId) => set({ selectedTeammateId: teammateId }),
      selectedTeammateTokenPosition: null,
      setSelectedTeammateTokenPosition: (position) =>
        set({ selectedTeammateTokenPosition: position }),
      selectedAssistantAction: null,
      setSelectedAssistantAction: (action) => set({ selectedAssistantAction: action }),
      chatSettings: defaultSettings,
      setChatSettings: (settings) => set({ chatSettings: settings }),
      chatInput: "",
      setChatInput: (query) => set({ chatInput: query }),
      showSearch: false,
      setShowSearch: (showSearch) => set({ showSearch }),

      setAuthenticatedUserConfiguration: ({ hasApiKey, user, userSettings }) =>
        set((state) => {
          const temporaryChatsDefault = Boolean(userSettings?.temporary_chats_default);

          return {
            hasApiKey,
            user,
            userSettings,
            hasHydratedUserConfiguration: true,
            isAuthenticated: true,
            isPro: user?.plan_id === "pro",
            localOnlyMode:
              !state.hasHydratedUserConfiguration && !state.currentConversationId
                ? temporaryChatsDefault
                : state.localOnlyMode,
            temporaryChatsDefault,
          };
        }),
      setUserSettings: (userSettings) =>
        set({
          userSettings,
          temporaryChatsDefault: Boolean(userSettings?.temporary_chats_default),
        }),
      clearAuthenticatedUserConfiguration: () =>
        set({
          hasApiKey: false,
          user: null,
          userSettings: null,
          hasHydratedUserConfiguration: false,
          isAuthenticated: false,
          isPro: false,
          temporaryChatsDefault: false,
        }),

      initializeStore: async (completionId?: string) => {
        if (completionId) {
          set({ currentConversationId: completionId });
        }

        const apiKey = await apiKeyService.getApiKey();

        set({ hasApiKey: !!apiKey });
      },
    }),
    {
      name: "chat-store",
      version: 3,
      migrate: migrateChatStore,
      partialize: (state) => ({
        localOnlyMode: state.localOnlyMode,
        chatMode: state.chatMode,
        homeChatMode: state.homeChatMode,
        model: state.model,
        modelTier: state.modelTier,
        useMultiModel: state.useMultiModel,
        chatSettings: state.chatSettings,
        selectedTeammateId: state.selectedTeammateId,
      }),
    },
  ),
);
