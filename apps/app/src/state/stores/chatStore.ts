import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiKeyService } from "~/lib/api/api-key";
import { defaultModel } from "~/lib/models";
import type { ChatMode, ChatSettings } from "~/types";

const defaultSettings: ChatSettings = {
  temperature: 1,
  top_p: 1,
  max_tokens: 2048,
  presence_penalty: 0,
  frequency_penalty: 0,
  useRAG: false,
  ragOptions: {
    topK: 3,
    scoreThreshold: 0.5,
    includeMetadata: false,
    namespace: "",
  },
  responseMode: "normal",
};

export interface ChatStore {
  // Conversation management
  currentConversationId: string | undefined;
  setCurrentConversationId: (id: string | undefined) => void;
  startNewConversation: (id?: string) => void;
  clearCurrentConversation: () => void;

  // UI state
  isMobile: boolean;
  setIsMobile: (isMobile: boolean) => void;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  showKeyboardShortcuts: boolean;
  setShowKeyboardShortcuts: (showKeyboardShortcuts: boolean) => void;

  // Authentication state
  hasApiKey: boolean;
  setHasApiKey: (hasApiKey: boolean) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  isAuthenticationLoading: boolean;
  setIsAuthenticationLoading: (isAuthenticationLoading: boolean) => void;
  isPro: boolean;
  setIsPro: (isPro: boolean) => void;
  turnstileToken: string | null;
  setTurnstileToken: (token: string | null) => void;

  // Chat mode and settings
  localOnlyMode: boolean;
  setLocalOnlyMode: (localOnly: boolean) => void;
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
  model: string;
  setModel: (model: string) => void;
  chatSettings: ChatSettings;
  setChatSettings: (settings: ChatSettings) => void;
  showSearch: boolean;
  setShowSearch: (showSearch: boolean) => void;

  // Initialization
  initializeStore: (completionId?: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Conversation management
      currentConversationId: undefined,
      setCurrentConversationId: (id) => set({ currentConversationId: id }),
      startNewConversation: (id?: string) => {
        const newId = id || `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        set({ currentConversationId: newId });
      },
      clearCurrentConversation: () => set({ currentConversationId: undefined }),

      // UI state
      isMobile: false,
      setIsMobile: (isMobile) => set({ isMobile }),
      sidebarVisible: true,
      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
      showKeyboardShortcuts: false,
      setShowKeyboardShortcuts: (showKeyboardShortcuts) =>
        set({ showKeyboardShortcuts }),
      showSearch: false,
      setShowSearch: (showSearch) => set({ showSearch }),

      // Authentication state
      hasApiKey: false,
      setHasApiKey: (hasApiKey) => set({ hasApiKey }),
      isAuthenticated: false,
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      isAuthenticationLoading: true,
      setIsAuthenticationLoading: (isAuthenticationLoading) =>
        set({ isAuthenticationLoading }),
      isPro: false,
      setIsPro: (isPro) => set({ isPro }),
      turnstileToken: null,
      setTurnstileToken: (token) => set({ turnstileToken: token }),

      // Chat mode and settings
      localOnlyMode: false,
      setLocalOnlyMode: (localOnly) => set({ localOnlyMode: localOnly }),
      chatMode: "remote" as ChatMode,
      setChatMode: (mode) => set({ chatMode: mode }),
      model: defaultModel,
      setModel: (model) => set({ model }),
      chatSettings: defaultSettings,
      setChatSettings: (settings) => set({ chatSettings: settings }),

      // Initialization
      initializeStore: async (completionId?: string) => {
        const apiKey = await apiKeyService.getApiKey();
        set({ hasApiKey: !!apiKey });

        const localOnlyMode =
          window.localStorage.getItem("localOnlyMode") === "true";
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
        model: state.model,
        chatSettings: state.chatSettings,
      }),
    },
  ),
);
