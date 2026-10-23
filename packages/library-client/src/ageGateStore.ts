import { create } from "zustand";

interface AgeGatePromptState {
  isOpen: boolean;
  settle: ((allowed: boolean) => void) | null;
  requestConfirmation: () => Promise<boolean>;
  finish: (allowed: boolean) => void;
}

export const useAgeGatePromptStore = create<AgeGatePromptState>()((set, get) => ({
  isOpen: false,
  settle: null,
  requestConfirmation: () => {
    get().settle?.(false);

    return new Promise<boolean>((resolve) => {
      set({ isOpen: true, settle: resolve });
    });
  },
  finish: (allowed) => {
    get().settle?.(allowed);
    set({ isOpen: false, settle: null });
  },
}));
