import { create } from "zustand";

import { useUIStore } from "../../state/stores/uiStore.js";

export const usePolyPrompt = create<{ prompt: string | null }>(() => ({ prompt: null }));

export function openPolyWithPrompt(prompt: string): void {
  usePolyPrompt.setState({ prompt });
  useUIStore.getState().setShowPoly(true);
}

export function consumePolyPrompt(prompt: string): void {
  if (usePolyPrompt.getState().prompt === prompt) {
    usePolyPrompt.setState({ prompt: null });
  }
}
