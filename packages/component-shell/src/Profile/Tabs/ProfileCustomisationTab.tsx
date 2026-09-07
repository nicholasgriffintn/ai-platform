import { USER_SETTINGS_FORM_ID } from "@ngriffin_uk/polychat-component-account";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useAuthStatus } from "@ngriffin_uk/polychat-library-react";

import { ProfileTab } from "../ProfileTabLayout.js";
import { ThemeSettings } from "../ThemeSettings.js";
import { UserSettingsForm } from "../UserSettingsForm.js";

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
