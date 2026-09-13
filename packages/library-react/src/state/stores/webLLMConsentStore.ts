import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WebLLMConsentStore {
  consentedModelIds: Record<string, true>;
  pendingModelId: string | null;
  hasConsented: (modelId: string) => boolean;
  requestConsent: (modelId: string) => void;
  confirmConsent: (modelId: string) => void;
  cancelConsent: () => void;
}

export const useWebLLMConsentStore = create<WebLLMConsentStore>()(
  persist(
    (set, get) => ({
      consentedModelIds: {},
      pendingModelId: null,
      hasConsented: (modelId) => get().consentedModelIds[modelId] ?? false,
      requestConsent: (modelId) => {
        if (!get().consentedModelIds[modelId]) {
          set({ pendingModelId: modelId });
        }
      },
      confirmConsent: (modelId) =>
        set((state) => ({
          consentedModelIds: { ...state.consentedModelIds, [modelId]: true },
          pendingModelId: null,
        })),
      cancelConsent: () => set({ pendingModelId: null }),
    }),
    {
      name: "webllm-consent",
      partialize: (state) => ({ consentedModelIds: state.consentedModelIds }),
    },
  ),
);
