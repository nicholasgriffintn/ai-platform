import { useChatStore } from "@ngriffin_uk/polychat-library-react";

export function useCanAccessProFeatures(): boolean {
  return useChatStore((state) => state.isAuthenticated && state.isPro);
}
