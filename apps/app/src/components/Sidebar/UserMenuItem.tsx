import { UserMenuItem as ControlledUserMenuItem } from "@ngriffin_uk/polychat-component-navigation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useAuthStatus, useIsHydrated, useUIStore } from "@ngriffin_uk/polychat-library-react";

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
