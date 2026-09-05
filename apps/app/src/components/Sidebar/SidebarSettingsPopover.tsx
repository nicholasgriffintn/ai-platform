import { ProviderGlyph } from "@ngriffin_uk/polychat-component-models";
import {
  SidebarSettingsPopover as ControlledSidebarSettingsPopover,
  type SidebarSettingsLinks,
} from "@ngriffin_uk/polychat-component-navigation";

import { SOURCE_CODE_URL } from "~/constants";
import { useAuthStatus } from "~/hooks/useAuth";
import { useUsageBalance } from "~/hooks/useUsage";
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
      onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
      onSignIn={() => setShowLoginModal(true)}
    />
  );
}
