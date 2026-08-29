import {
  type ConversationListFilters,
  DEFAULT_CONVERSATION_LIST_FILTERS,
} from "@ngriffin_uk/polychat-component-navigation";
import { create } from "zustand";
import { persist } from "zustand/middleware";

function initialIsMobile(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(max-width: 768px)").matches;
}

export interface UIStore {
  isMobile: boolean;
  setIsMobile: (isMobile: boolean) => void;
  isMobileLoading: boolean;
  setIsMobileLoading: (isMobileLoading: boolean) => void;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  showLoginModal: boolean;
  setShowLoginModal: (showLoginModal: boolean) => void;
  showKeyboardShortcuts: boolean;
  setShowKeyboardShortcuts: (showKeyboardShortcuts: boolean) => void;
  conversationListFilters: ConversationListFilters;
  setConversationListFilters: (filters: Partial<ConversationListFilters>) => void;
  resetConversationListFilters: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      isMobileLoading: true,
      setIsMobileLoading: (isMobileLoading) => set({ isMobileLoading }),
      isMobile: initialIsMobile(),
      setIsMobile: (isMobile) => set({ isMobile }),
      sidebarVisible: !initialIsMobile(),
      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
      showLoginModal: false,
      setShowLoginModal: (showLoginModal) => set({ showLoginModal }),
      showKeyboardShortcuts: false,
      setShowKeyboardShortcuts: (showKeyboardShortcuts) => set({ showKeyboardShortcuts }),
      conversationListFilters: DEFAULT_CONVERSATION_LIST_FILTERS,
      setConversationListFilters: (filters) =>
        set((state) => ({
          conversationListFilters: { ...state.conversationListFilters, ...filters },
        })),
      resetConversationListFilters: () =>
        set({ conversationListFilters: DEFAULT_CONVERSATION_LIST_FILTERS }),
    }),
    {
      name: "ui-store",
      merge: (persisted, current) => {
        const {
          isMobile: _m,
          isMobileLoading: _l,
          sidebarVisible: _s,
          conversationListFilters,
          ...rest
        } = (persisted ?? {}) as Partial<UIStore>;

        return {
          ...current,
          ...rest,
          conversationListFilters: {
            ...DEFAULT_CONVERSATION_LIST_FILTERS,
            ...conversationListFilters,
          },
        };
      },
    },
  ),
);
