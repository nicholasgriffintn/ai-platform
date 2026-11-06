import { create } from "zustand";

interface AgeGatePromptState {
  isOpen: boolean;
  showsCrisisSignpost: boolean;
  settle: ((allowed: boolean) => void) | null;
  requestConfirmation: (options?: { showsCrisisSignpost?: boolean }) => Promise<boolean>;
  finish: (allowed: boolean) => void;
}

export const useAgeGatePromptStore = create<AgeGatePromptState>()((set, get) => ({
  isOpen: false,
  showsCrisisSignpost: false,
  settle: null,
  requestConfirmation: (options) => {
    get().settle?.(false);

    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        showsCrisisSignpost: options?.showsCrisisSignpost ?? false,
        settle: resolve,
      });
    });
  },
  finish: (allowed) => {
    get().settle?.(allowed);
    set({ isOpen: false, showsCrisisSignpost: false, settle: null });
  },
}));
