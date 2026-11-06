import type { RunMeter, UsageLimitsPayload } from "@ngriffin_uk/polychat-schemas";
import { create } from "zustand";

export type UsageLimits = UsageLimitsPayload;

export interface ConversationRunMeter {
  conversationId: string;
  meter: RunMeter;
}

interface UsageStore {
  usageLimits: UsageLimits | null;
  setUsageLimits: (usageLimits: UsageLimits | null) => void;
  runMeter: ConversationRunMeter | null;
  setRunMeter: (runMeter: ConversationRunMeter | null) => void;
}

export const useUsageStore = create<UsageStore>()((set) => ({
  usageLimits: null,
  setUsageLimits: (usageLimits) => set({ usageLimits }),
  runMeter: null,
  setRunMeter: (runMeter) => set({ runMeter }),
}));
