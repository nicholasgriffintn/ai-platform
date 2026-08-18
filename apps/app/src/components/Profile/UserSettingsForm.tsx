import {
  UserSettingsForm as ControlledUserSettingsForm,
  type UserSettings,
} from "@ngriffin_uk/polychat-component-account";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useAuthStatus } from "~/hooks/useAuth";
import { useUIStore } from "~/state/stores/uiStore";

interface UserSettingsFormProps {
  userSettings: UserSettings | null;
  isAuthenticated: boolean;
  isPro?: boolean;
}

export function UserSettingsForm({
  userSettings,
  isAuthenticated,
  isPro = false,
}: UserSettingsFormProps) {
  const { updateUserSettings, isUpdatingUserSettings } = useAuthStatus();
  const { trackError } = useTrackEvent();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  return (
    <ControlledUserSettingsForm
      userSettings={userSettings}
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
