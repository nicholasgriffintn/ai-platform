import {
  UserSettingsForm as ControlledUserSettingsForm,
  type UserSettings,
} from "@ngriffin_uk/polychat-component-account";
import { useTrackEvent, useAuthStatus, useUIStore } from "@ngriffin_uk/polychat-library-react";
import type { ReactNode } from "react";

interface UserSettingsFormProps {
  userSettings: UserSettings | null;
  afterPersonalisedResponses?: ReactNode;
  showSubmit?: boolean;
  isAuthenticated: boolean;
  isPro?: boolean;
}

export function UserSettingsForm({
  userSettings,
  afterPersonalisedResponses,
  showSubmit = true,
  isAuthenticated,
  isPro = false,
}: UserSettingsFormProps) {
  const { updateUserSettings, isUpdatingUserSettings } = useAuthStatus();
  const { trackError } = useTrackEvent();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  return (
    <ControlledUserSettingsForm
      userSettings={userSettings}
      afterPersonalisedResponses={afterPersonalisedResponses}
      showSubmit={showSubmit}
      isAuthenticated={isAuthenticated}
      isPro={isPro}
      isSaving={isUpdatingUserSettings}
      onSignIn={() => setShowLoginModal(true)}
      onSave={async (settings) => {
        await updateUserSettings(settings);
      }}
      onSaveError={(error) => trackError("settings_save_failed", error)}
    />
  );
}
