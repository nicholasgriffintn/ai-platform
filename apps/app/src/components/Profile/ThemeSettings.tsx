import {
  DEFAULT_THEME_PAIR,
  DEFAULT_THEME_PREFERENCE,
  ThemePicker,
} from "@ngriffin_uk/polychat-component-ui";

import { ProfileTabSection } from "~/components/Profile/ProfileTabLayout";
import { useIsHydrated } from "~/hooks/useIsHydrated";
import {
  useSetThemePair,
  useSetThemePreference,
  useThemePair,
  useThemePreference,
} from "~/hooks/useTheme";

export function ThemeSettings() {
  const preference = useThemePreference();
  const setPreference = useSetThemePreference();
  const pair = useThemePair();
  const setPair = useSetThemePair();
  const isHydrated = useIsHydrated();

  return (
    <ProfileTabSection
      title="Theme"
      description="Kept on this device rather than your account, so each perch can differ."
    >
      <ThemePicker
        value={isHydrated ? preference : DEFAULT_THEME_PREFERENCE}
        onChange={setPreference}
        pair={isHydrated ? pair : DEFAULT_THEME_PAIR}
        onPairChange={setPair}
      />
    </ProfileTabSection>
  );
}
