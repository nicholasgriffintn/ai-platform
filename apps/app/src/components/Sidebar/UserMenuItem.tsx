import { UserMenuItem as ControlledUserMenuItem } from "@ngriffin_uk/polychat-component-navigation";

import { useAuthStatus } from "~/hooks/useAuth";
import { useIsHydrated } from "~/hooks/useIsHydrated";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

export function UserMenuItem() {
	const { setShowLoginModal } = useUIStore();
	const { isAuthenticated } = useChatStore();
	const { user, isLoggingOut, isLoading } = useAuthStatus();
	const isHydrated = useIsHydrated();

	return (
		<ControlledUserMenuItem
			account={user ? { name: user.name, avatarUrl: user.avatar_url } : null}
			isAuthenticated={isAuthenticated}
			isLoading={isLoading}
			isLoggingOut={isLoggingOut}
			isReady={isHydrated}
			profileHref="/profile"
			onSignIn={() => setShowLoginModal(true)}
		/>
	);
}
