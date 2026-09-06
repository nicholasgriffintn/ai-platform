import { useChatStore } from "@ngriffin_uk/polychat-library-client";

export function useCanAccessProFeatures(): boolean {
  return useChatStore((state) => state.isAuthenticated && state.isPro);
}
