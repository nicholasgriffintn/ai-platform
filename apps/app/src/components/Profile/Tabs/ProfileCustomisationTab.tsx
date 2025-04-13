import { UserSettingsForm } from "~/components/UserSettingsForm";
import { useAuthStatus } from "~/hooks/useAuth";

export function ProfileCustomisationTab() {
  const { userSettings, isAuthenticated } = useAuthStatus();

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-6">
        Customise Chat
      </h1>

      <div className="space-y-6">
        <UserSettingsForm
          userSettings={userSettings}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </div>
  );
}
