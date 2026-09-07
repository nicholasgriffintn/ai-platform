import { ProviderGlyph } from "@ngriffin_uk/polychat-component-models";
import {
  SidebarSettingsPopover as ControlledSidebarSettingsPopover,
  type SidebarSettingsLinks,
} from "@ngriffin_uk/polychat-component-navigation";
import { SOURCE_CODE_URL, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  getSidebarUsageItems,
  PROFILE_PATH,
  useAuthStatus,
  useSetThemePreference,
  useThemePreference,
  useUIStore,
  useUsageBalance,
  useUsageStore,
} from "@ngriffin_uk/polychat-library-react";

import { useShellHost } from "../Host/ShellHostContext";

const links: SidebarSettingsLinks = {
  account: PROFILE_PATH,
  customisation: `${PROFILE_PATH}?tab=customisation`,
  providers: `${PROFILE_PATH}?tab=providers`,
  billing: `${PROFILE_PATH}?tab=billing`,
  terms: "/terms",
  privacy: "/privacy",
  sourceCode: SOURCE_CODE_URL,
};

export function SidebarSettingsPopover() {
  const setShowKeyboardShortcuts = useUIStore((state) => state.setShowKeyboardShortcuts);
  const { openSignIn, signOut } = useShellHost();
  const { user, isLoading } = useAuthStatus();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const usageLimits = useUsageStore((state) => state.usageLimits);
  const themePreference = useThemePreference();
  const setThemePreference = useSetThemePreference();
  const planId: string | null | undefined = user?.plan_id;
  const hasPaidPlan = planId === "pro" || planId === "enterprise";
  const usageBalance = useUsageBalance();

  return (
    <ControlledSidebarSettingsPopover
      account={
        user
          ? {
              name: user.name,
              avatarUrl: user.avatar_url,
              planLabel: planId === "enterprise" ? "Enterprise" : hasPaidPlan ? "Pro" : "Free",
            }
          : null
      }
      isAuthenticated={isAuthenticated}
      isLoading={isLoading}
      isUsageLoading={isLoading || (isAuthenticated && usageBalance.isLoading)}
      links={links}
      sourceCodeIcon={<ProviderGlyph name="github" size={16} />}
      usage={getSidebarUsageItems(usageLimits, usageBalance.data?.credits)}
      theme={{ value: themePreference, onChange: setThemePreference }}
      onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
      onSignIn={openSignIn}
      onSignOut={signOut}
    />
  );
}
