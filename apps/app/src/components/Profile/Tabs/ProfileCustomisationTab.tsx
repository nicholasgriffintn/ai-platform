import { PageHeader } from "~/components/PageHeader";
import { PageTitle } from "~/components/PageTitle";
import { UserSettingsForm } from "~/components/UserSettingsForm";
import { useAuthStatus } from "~/hooks/useAuth";

export function ProfileCustomisationTab() {
  const { userSettings, isAuthenticated } = useAuthStatus();

  return (
    <div>
      <PageHeader>
        <PageTitle title="Customise Chat" />
      </PageHeader>

      <div className="space-y-6">
        <UserSettingsForm
          userSettings={userSettings}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </div>
  );
}
