import { create } from "zustand";

export interface UsageLimits {
	daily: {
		used: number;
		limit: number;
	};
	pro?: {
		used: number;
		limit: number;
	};
	byok?: {
		used: number;
		limit: null;
	};
}

interface UsageStore {
	usageLimits: UsageLimits | null;
	setUsageLimits: (usageLimits: UsageLimits | null) => void;
}

export const useUsageStore = create<UsageStore>()((set) => ({
	usageLimits: null,
	setUsageLimits: (usageLimits) => set({ usageLimits }),
}));
