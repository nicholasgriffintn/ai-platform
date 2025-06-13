import { create } from "zustand";
import { persist } from "zustand/middleware";

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
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      isMobileLoading: true,
      setIsMobileLoading: (isMobileLoading) => set({ isMobileLoading }),
      isMobile: false,
      setIsMobile: (isMobile) => set({ isMobile }),
      sidebarVisible: true,
      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
      showLoginModal: false,
      setShowLoginModal: (showLoginModal) => set({ showLoginModal }),
      showKeyboardShortcuts: false,
      setShowKeyboardShortcuts: (showKeyboardShortcuts) =>
        set({ showKeyboardShortcuts }),
    }),
    {
      name: "ui-store",
    },
  ),
);
