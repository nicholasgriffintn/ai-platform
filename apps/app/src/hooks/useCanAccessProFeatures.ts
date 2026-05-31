import { useChatStore } from "~/state/stores/chatStore";

export function useCanAccessProFeatures(): boolean {
	return useChatStore((state) => state.isAuthenticated && state.isPro);
}
