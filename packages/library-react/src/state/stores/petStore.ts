import { create } from "zustand";

const MAX_NUDGES = 3;

export interface PetNudge {
  id: string;
  message: string;
  actionLabel?: string;
  href?: string;
}

export interface PetGaze {
  anchor: string;
  until: number;
}

interface PetStore {
  nudges: PetNudge[];
  dismissed: Record<string, true>;
  reviewing: Record<string, true>;
  listening: boolean;
  speaking: boolean;
  gaze: PetGaze | null;
  setReviewing: (conversationId: string, reviewing: boolean) => void;
  setListening: (listening: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  lookAt: (anchor: string, durationMs: number) => void;
  clearGaze: (anchor?: string) => void;
  pushNudge: (nudge: PetNudge) => void;
  retractNudge: (id: string) => void;
  dismissNudge: (id: string) => void;
}

export const usePetStore = create<PetStore>()((set) => ({
  nudges: [],
  dismissed: {},
  reviewing: {},
  listening: false,
  speaking: false,
  gaze: null,
  setReviewing: (conversationId, reviewing) =>
    set((state) => {
      if (conversationId in state.reviewing === reviewing) {
        return state;
      }

      const next = { ...state.reviewing };

      if (reviewing) {
        next[conversationId] = true;
      } else {
        delete next[conversationId];
      }

      return { reviewing: next };
    }),
  setListening: (listening) =>
    set((state) => (state.listening === listening ? state : { listening })),
  setSpeaking: (speaking) => set((state) => (state.speaking === speaking ? state : { speaking })),
  lookAt: (anchor, durationMs) => set({ gaze: { anchor, until: Date.now() + durationMs } }),
  clearGaze: (anchor) =>
    set((state) => (anchor && state.gaze?.anchor !== anchor ? state : { gaze: null })),
  pushNudge: (nudge) =>
    set((state) => {
      if (state.dismissed[nudge.id] || state.nudges.some((entry) => entry.id === nudge.id)) {
        return state;
      }

      return { nudges: [...state.nudges, nudge].slice(-MAX_NUDGES) };
    }),
  retractNudge: (id) =>
    set((state) => {
      if (!state.nudges.some((entry) => entry.id === id)) {
        return state;
      }

      return { nudges: state.nudges.filter((entry) => entry.id !== id) };
    }),
  dismissNudge: (id) =>
    set((state) => ({
      nudges: state.nudges.filter((entry) => entry.id !== id),
      dismissed: { ...state.dismissed, [id]: true },
    })),
}));
