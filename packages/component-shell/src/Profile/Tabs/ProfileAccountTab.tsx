import {
  AccountOverview,
  ConversationHandleSettings,
} from "@ngriffin_uk/polychat-component-account";
import {
  useAuthStatus,
  useUsageBalance,
  useUIStore,
  useConversationHandles,
} from "@ngriffin_uk/polychat-library-react";

import { ProfileTab } from "../ProfileTabLayout.js";

export function ProfileAccountTab() {
  const { user, isAuthenticated, isLoading } = useAuthStatus();
  const usageBalance = useUsageBalance(isAuthenticated);
  const handles = useConversationHandles(isAuthenticated);
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
      {isAuthenticated && (
        <ConversationHandleSettings
          handles={handles.data?.handles ?? []}
          isLoading={handles.isLoading}
          isRevoking={handles.revoke.isPending}
          hasError={handles.isError || handles.revoke.isError}
          onRevoke={handles.revoke.mutate}
        />
      )}
    </ProfileTab>
  );
}
