import { AccountOverview } from "@ngriffin_uk/polychat-component-account";

import { PageShell } from "~/components/Core/PageShell";
import { useAuthStatus } from "~/hooks/useAuth";
import { useUsageBalance } from "~/hooks/useUsage";
import { useUIStore } from "~/state/stores/uiStore";

export function ProfileAccountTab() {
  const { user, isAuthenticated, isLoading } = useAuthStatus();
  const usageBalance = useUsageBalance(isAuthenticated);
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  return (
    <>
      <PageShell.Header title="Account" />
      <AccountOverview
        user={user}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        usageBalance={usageBalance.data}
        onSignIn={() => setShowLoginModal(true)}
      />
    </>
  );
}
