import { AccountOverview } from "@ngriffin_uk/polychat-component-account";
import { useAuthStatus, useUsageBalance, useUIStore } from "@ngriffin_uk/polychat-library-react";

import { ProfileTab } from "~/components/Profile/ProfileTabLayout";

export function ProfileAccountTab() {
  const { user, isAuthenticated, isLoading } = useAuthStatus();
  const usageBalance = useUsageBalance(isAuthenticated);
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  return (
    <ProfileTab title="Account">
      <AccountOverview
        user={user}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        usageBalance={usageBalance.data}
        onSignIn={() => setShowLoginModal(true)}
      />
    </ProfileTab>
  );
}
