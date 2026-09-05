import { USER_SETTINGS_FORM_ID } from "@ngriffin_uk/polychat-component-account";
import { Button } from "@ngriffin_uk/polychat-component-ui";

import { ProfileTab } from "~/components/Profile/ProfileTabLayout";
import { ThemeSettings } from "~/components/Profile/ThemeSettings";
import { UserSettingsForm } from "~/components/Profile/UserSettingsForm";
import { useAuthStatus } from "~/hooks/useAuth";

export function ProfileCustomisationTab() {
  const { user, userSettings, isAuthenticated, isUpdatingUserSettings } = useAuthStatus();

  return (
    <ProfileTab
      title="Customise Chat"
      actionContent={
        <Button
          type="submit"
          form={USER_SETTINGS_FORM_ID}
          variant="primary"
          size="sm"
          disabled={isUpdatingUserSettings}
        >
          {isUpdatingUserSettings ? "Saving..." : "Save"}
        </Button>
      }
    >
      <UserSettingsForm
        userSettings={userSettings ?? null}
        afterPersonalisedResponses={<ThemeSettings />}
        isAuthenticated={isAuthenticated}
        isPro={user?.plan_id === "pro"}
        showSubmit={false}
      />
    </ProfileTab>
  );
}
