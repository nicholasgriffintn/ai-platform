import { migrateChatStore, resolveAccountModelSelection } from "@ngriffin_uk/polychat-library-chat";
import type { ChatSettings } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import type {
  AssistantActionSelection,
  ChatMode,
  ComputeSite,
  HomeChatModeId,
  ModelTier,
  PermissionMode,
} from "@ngriffin_uk/polychat-schemas";
import type { User, UserSettings } from "@ngriffin_uk/polychat-schemas/user-profile";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiKeyService } from "./api-key.js";

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

  temporaryChat: boolean | undefined;
  setTemporaryChat: (temporaryChat: boolean | undefined) => void;
  temporaryChatsDefault: boolean;
  setTemporaryChatsDefault: (temporaryChatsDefault: boolean) => void;
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
  computeSite: ComputeSite;
  setComputeSite: (computeSite: ComputeSite) => void;
  homeChatMode: HomeChatModeId;
  setHomeChatMode: (mode: HomeChatModeId) => void;
  model: string | null;
  modelSelectionOrigin: "account" | "local" | "conversation";
  setModel: (model: string | null) => void;
  modelTier: ModelTier | null;
  setModelTier: (tier: ModelTier | null) => void;
  setConversationModelSelection: (selection: {
    model?: string | null;
    modelTier?: ModelTier | null;
    permissionMode?: PermissionMode;
  }) => void;
  permissionMode: PermissionMode;
  setPermissionMode: (mode: PermissionMode) => void;
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
      setCurrentConversationId: (id) =>
        set({ currentConversationId: id, temporaryChat: undefined, isComposingGoal: false }),
      setComposingGoal: (composing) => set({ isComposingGoal: composing }),
      startNewConversation: (id?: string) => {
        const conversationId = id || generateId();

        set((state) => ({
          currentConversationId: conversationId,
          temporaryChat: undefined,
          ...(state.modelSelectionOrigin === "conversation"
            ? {
                ...resolveAccountModelSelection(state.userSettings),
                modelSelectionOrigin: "account" as const,
                permissionMode: "auto_accept_edits" as const,
              }
            : {}),
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
        set({ currentConversationId: undefined, temporaryChat: undefined, isComposingGoal: false }),

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

      temporaryChat: undefined,
      setTemporaryChat: (temporaryChat) => set({ temporaryChat }),
      temporaryChatsDefault: false,
      setTemporaryChatsDefault: (temporaryChatsDefault) => set({ temporaryChatsDefault }),
      chatMode: "chat",
      setChatMode: (mode) => set({ chatMode: mode }),
      computeSite: "hosted",
      setComputeSite: (computeSite) => set({ computeSite, modelSelectionOrigin: "local" }),
      homeChatMode: "chat",
      setHomeChatMode: (mode) => set({ homeChatMode: mode }),
      model: null,
      modelSelectionOrigin: "local" as const,
      setModel: (model) => set({ model, modelSelectionOrigin: "local" }),
      modelTier: null,
      setModelTier: (modelTier) => set({ modelTier, modelSelectionOrigin: "local" }),
      setConversationModelSelection: ({ model = null, modelTier = null, permissionMode }) =>
        set({
          model,
          modelTier,
          permissionMode: permissionMode ?? "auto_accept_edits",
          modelSelectionOrigin: "conversation",
        }),
      permissionMode: "auto_accept_edits",
      setPermissionMode: (permissionMode) => set({ permissionMode }),
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
          const accountSelection = resolveAccountModelSelection(userSettings);
          const shouldHydrateSelection =
            state.modelSelectionOrigin === "account" ||
            (!state.hasHydratedUserConfiguration && state.model === null);
          const shouldHydrateComputeSite =
            state.modelSelectionOrigin === "account" ||
            (!state.hasHydratedUserConfiguration && state.computeSite === "hosted");

          return {
            hasApiKey,
            user,
            userSettings,
            hasHydratedUserConfiguration: true,
            isAuthenticated: true,
            isPro: user?.plan_id === "pro",
            temporaryChatsDefault,
            ...(shouldHydrateSelection
              ? {
                  model: accountSelection.model,
                  modelTier: accountSelection.modelTier,
                  modelSelectionOrigin: "account" as const,
                }
              : {}),
            ...(shouldHydrateComputeSite ? { computeSite: accountSelection.computeSite } : {}),
          };
        }),
      setUserSettings: (userSettings) =>
        set((state) => {
          const accountSelection = resolveAccountModelSelection(userSettings);
          const shouldHydrateSelection = state.modelSelectionOrigin === "account";

          return {
            userSettings,
            temporaryChatsDefault: Boolean(userSettings?.temporary_chats_default),
            ...(shouldHydrateSelection
              ? {
                  model: accountSelection.model,
                  modelTier: accountSelection.modelTier,
                  computeSite: accountSelection.computeSite,
                }
              : {}),
          };
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
          modelSelectionOrigin: "local",
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
      version: 4,
      migrate: migrateChatStore,
      partialize: (state) => ({
        chatMode: state.chatMode,
        computeSite: state.computeSite,
        homeChatMode: state.homeChatMode,
        model: state.model,
        modelTier: state.modelTier,
        permissionMode: state.permissionMode,
        useMultiModel: state.useMultiModel,
        chatSettings: state.chatSettings,
        selectedTeammateId: state.selectedTeammateId,
        modelSelectionOrigin: state.modelSelectionOrigin,
      }),
    },
  ),
);
