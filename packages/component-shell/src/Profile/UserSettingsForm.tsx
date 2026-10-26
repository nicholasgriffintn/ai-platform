import {
  UserSettingsForm as ControlledUserSettingsForm,
  type UserSettings,
} from "@ngriffin_uk/polychat-component-account";
import {
  useAuthStatus,
  useSpeechModels,
  useSpeechVoiceLibrary,
  useTrackEvent,
  useUIStore,
} from "@ngriffin_uk/polychat-library-react";
import type { ReactNode } from "react";

import { KnowledgeReadingSettings } from "../Knowledge/KnowledgeReadingSettings.js";

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
  const { createVoice, deleteVoice, isCreatingVoice, isDeletingVoice } = useSpeechVoiceLibrary();
  const speechModels = useSpeechModels(isAuthenticated);

  return (
    <ControlledUserSettingsForm
      userSettings={userSettings}
      afterPersonalisedResponses={afterPersonalisedResponses}
      knowledgeSettings={isAuthenticated ? <KnowledgeReadingSettings /> : undefined}
      showSubmit={showSubmit}
      isAuthenticated={isAuthenticated}
      isPro={isPro}
      isSaving={isUpdatingUserSettings}
      onSignIn={() => setShowLoginModal(true)}
      onSave={async (settings) => {
        await updateUserSettings(settings);
      }}
      onSaveError={(error) => trackError("settings_save_failed", error)}
      speechModels={speechModels.data}
      speechVoiceLibrary={
        isAuthenticated
          ? {
              isCreating: isCreatingVoice,
              isDeleting: isDeletingVoice,
              onCreate: createVoice,
              onDelete: deleteVoice,
            }
          : undefined
      }
    />
  );
}
