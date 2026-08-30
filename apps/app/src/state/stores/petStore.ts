import { create } from "zustand";

const MAX_NUDGES = 3;

export interface PetNudge {
  id: string;
  message: string;
  actionLabel?: string;
  href?: string;
}

interface PetStore {
  nudges: PetNudge[];
  dismissed: Record<string, true>;
  pushNudge: (nudge: PetNudge) => void;
  retractNudge: (id: string) => void;
  dismissNudge: (id: string) => void;
}

export const usePetStore = create<PetStore>()((set) => ({
  nudges: [],
  dismissed: {},
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
