import { clampNumber } from "@ngriffin_uk/polychat-utility-core";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const WIND_DOWN_BALANCE_DEFAULT = 0.5;

export interface WindDownMixStore {
  balance: number;
  afterVoiceMinutes: number;
  setBalance: (balance: number) => void;
  setAfterVoiceMinutes: (minutes: number) => void;
}

export const useWindDownMixStore = create<WindDownMixStore>()(
  persist(
    (set) => ({
      balance: WIND_DOWN_BALANCE_DEFAULT,
      afterVoiceMinutes: 0,
      setBalance: (balance) => set({ balance: clampNumber(balance, 0, 1) }),
      setAfterVoiceMinutes: (afterVoiceMinutes) => set({ afterVoiceMinutes }),
    }),
    {
      name: "wind-down-mix",
      partialize: (state) => ({
        balance: state.balance,
        afterVoiceMinutes: state.afterVoiceMinutes,
      }),
    },
  ),
);
