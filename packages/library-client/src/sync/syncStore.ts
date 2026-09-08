import type { DeviceSyncPresenceEntry } from "@ngriffin_uk/polychat-schemas";
import { create } from "zustand";

import type { SyncStatus } from "./socket.js";

export interface SyncStore {
  status: SyncStatus;
  presence: Record<string, DeviceSyncPresenceEntry[]>;
  setStatus: (status: SyncStatus) => void;
  setPresence: (topic: string, devices: DeviceSyncPresenceEntry[]) => void;
}

export const useSyncStore = create<SyncStore>()((set) => ({
  status: "idle",
  presence: {},
  setStatus: (status) => set({ status }),
  setPresence: (topic, devices) =>
    set((state) => ({ presence: { ...state.presence, [topic]: devices } })),
}));

export function isSyncLive(): boolean {
  return useSyncStore.getState().status === "open";
}
