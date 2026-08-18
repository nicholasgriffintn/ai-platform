import { ProviderGlyph } from "@ngriffin_uk/polychat-component-models";
import {
  SidebarSettingsPopover as ControlledSidebarSettingsPopover,
  type SidebarSettingsLinks,
} from "@ngriffin_uk/polychat-component-navigation";

import { SOURCE_CODE_URL } from "~/constants";
import { useAuthStatus } from "~/hooks/useAuth";
import { useIsHydrated } from "~/hooks/useIsHydrated";
import { useTheme } from "~/hooks/useTheme";
import { getSidebarUsageItems } from "~/lib/sidebar-usage";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { useUsageStore } from "~/state/stores/usageStore";

const links: SidebarSettingsLinks = {
  account: "/profile",
  customisation: "/profile?tab=customisation",
  providers: "/profile?tab=providers",
  billing: "/profile?tab=billing",
  terms: "/terms",
  privacy: "/privacy",
  sourceCode: SOURCE_CODE_URL,
};

export function SidebarSettingsPopover() {
  const { setShowKeyboardShortcuts, setShowLoginModal } = useUIStore();
  const { user, isLoading } = useAuthStatus();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const usageLimits = useUsageStore((state) => state.usageLimits);
  const [theme, setTheme] = useTheme();
  const isHydrated = useIsHydrated();

  return (
    <ControlledSidebarSettingsPopover
      account={
        user
          ? {
              name: user.name,
              avatarUrl: user.avatar_url,
              planLabel: user.plan_id === "pro" ? "Pro" : "Free",
            }
          : null
      }
      isAuthenticated={isAuthenticated}
      isLoading={isLoading}
      links={links}
      sourceCodeIcon={<ProviderGlyph name="github" size={16} />}
      theme={isHydrated ? theme : undefined}
      usage={getSidebarUsageItems(usageLimits)}
      onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
      onSignIn={() => setShowLoginModal(true)}
      onThemeChange={setTheme}
    />
  );
}
