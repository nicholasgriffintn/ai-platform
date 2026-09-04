import { ChatInputPolicySettings } from "~/components/ConversationThread/ChatInputPolicySettings";
import { PageShell } from "~/components/Core/PageShell";
import { UserSettingsForm } from "~/components/Profile/UserSettingsForm";
import { useAuthStatus } from "~/hooks/useAuth";

export function ProfileCustomisationTab() {
  const { user, userSettings, isAuthenticated } = useAuthStatus();

  return (
    <div>
      <PageShell.Header title="Customise Chat" />

      <div className="space-y-6">
        {isAuthenticated && <ChatInputPolicySettings />}
        <UserSettingsForm
          userSettings={userSettings ?? null}
          isAuthenticated={isAuthenticated}
          isPro={user?.plan_id === "pro"}
        />
      </div>
    </div>
  );
}
