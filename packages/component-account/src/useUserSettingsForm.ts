import { omitMatchingProperties } from "@ngriffin_uk/polychat-utility-core";
import { useMemo, useState } from "react";

import { buildUserSettingsFormData, type UserSettings } from "./user-settings";

type UserSettingsFormData = ReturnType<typeof buildUserSettingsFormData>;

export function useUserSettingsForm(userSettings: UserSettings | null) {
  const savedFormData = useMemo(() => buildUserSettingsFormData(userSettings), [userSettings]);
  const settingsId = userSettings?.id;
  const [draft, setDraft] = useState<{
    settingsId: string | undefined;
    savedFormData: UserSettingsFormData;
    edits: Partial<UserSettingsFormData>;
  }>({ settingsId, savedFormData, edits: {} });
  let edits = draft.edits;

  if (draft.savedFormData !== savedFormData) {
    edits =
      draft.settingsId === undefined || draft.settingsId === settingsId
        ? omitMatchingProperties(draft.edits, savedFormData)
        : {};
    setDraft({ settingsId, savedFormData, edits });
  }

  const updateFormData = (patch: Partial<UserSettingsFormData>) => {
    setDraft((current) => ({
      ...current,
      edits: { ...current.edits, ...patch },
    }));
  };

  return { formData: { ...savedFormData, ...edits }, updateFormData };
}
