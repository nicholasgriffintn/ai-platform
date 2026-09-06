import type { UsageLimitsPayload } from "@ngriffin_uk/polychat-schemas";
import { create } from "zustand";

export type UsageLimits = UsageLimitsPayload;

interface UsageStore {
  usageLimits: UsageLimits | null;
  setUsageLimits: (usageLimits: UsageLimits | null) => void;
}

export const useUsageStore = create<UsageStore>()((set) => ({
  usageLimits: null,
  setUsageLimits: (usageLimits) => set({ usageLimits }),
}));
