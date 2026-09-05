import { DEFAULT_THEME_PREFERENCE, ThemePicker } from "@ngriffin_uk/polychat-component-ui";

import { ProfileTabSection } from "~/components/Profile/ProfileTabLayout";
import { useIsHydrated } from "~/hooks/useIsHydrated";
import { useSetThemePreference, useThemePreference } from "~/hooks/useTheme";

export function ThemeSettings() {
  const preference = useThemePreference();
  const setPreference = useSetThemePreference();
  const isHydrated = useIsHydrated();

  return (
    <ProfileTabSection
      title="Theme"
      description="Kept on this device rather than your account, so each perch can differ."
    >
      <ThemePicker
        value={isHydrated ? preference : DEFAULT_THEME_PREFERENCE}
        onChange={setPreference}
      />
    </ProfileTabSection>
  );
}
