import type { DeviceSyncPresenceEntry } from "@ngriffin_uk/polychat-schemas";
import { create } from "zustand";

import type { SyncStatus } from "./socket.js";

export interface SyncStore {
  status: SyncStatus;
  presence: Record<string, DeviceSyncPresenceEntry[]>;
  lastEventAt: number;
  setStatus: (status: SyncStatus) => void;
  setPresence: (topic: string, devices: DeviceSyncPresenceEntry[]) => void;
  noteEvent: () => void;
}

export const useSyncStore = create<SyncStore>()((set) => ({
  status: "idle",
  presence: {},
  lastEventAt: 0,
  setStatus: (status) => set({ status }),
  setPresence: (topic, devices) =>
    set((state) => ({ presence: { ...state.presence, [topic]: devices } })),
  noteEvent: () => set({ lastEventAt: Date.now() }),
}));

export function isSyncLive(): boolean {
  return useSyncStore.getState().status === "open";
}
