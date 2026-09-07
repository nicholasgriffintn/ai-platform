import { AccountSidebarShell } from "@ngriffin_uk/polychat-component-account";
import { useAuthStatus, useUIStore } from "@ngriffin_uk/polychat-library-react";

import { SidebarFooter } from "../Sidebar/SidebarFooter.js";
import { SidebarHeader } from "../Sidebar/SidebarHeader.js";
import { ProfileAccountTab } from "./Tabs/ProfileAccountTab.js";
import { ProfileApiKeysTab } from "./Tabs/ProfileApiKeysTab.js";
import { ProfileBillingTab } from "./Tabs/ProfileBillingTab.js";
import { ProfileCustomisationTab } from "./Tabs/ProfileCustomisationTab.js";
import { ProfileHistoryTab } from "./Tabs/ProfileHistoryTab.js";
import { ProfilePasskeysTab } from "./Tabs/ProfilePasskeysTab.js";
import { ProfilePetsTab } from "./Tabs/ProfilePetsTab.js";
import { ProfileProvidersTab } from "./Tabs/ProfileProvidersTab.js";
import { ProfileSandboxTab } from "./Tabs/ProfileSandboxTab.js";
import { ProfileTrainingTab } from "./Tabs/ProfileTrainingTab.js";

interface ProfileSidebarItem {
  id: string;
  label: string;
  group: string;
  pageTitle?: string;
  component: React.FC;
}

const ACCOUNT_GROUP = "Account";
const APPEARANCE_GROUP = "Appearance and pet";
const MODELS_GROUP = "Models and keys";
const ADVANCED_GROUP = "Advanced";

export const profileSidebarItems: ProfileSidebarItem[] = [
  { id: "account", label: "Account", group: ACCOUNT_GROUP, component: ProfileAccountTab },
  { id: "passkeys", label: "Passkeys", group: ACCOUNT_GROUP, component: ProfilePasskeysTab },
  { id: "billing", label: "Billing", group: ACCOUNT_GROUP, component: ProfileBillingTab },
  {
    id: "history",
    label: "Chat history",
    group: ACCOUNT_GROUP,
    component: ProfileHistoryTab,
  },
  {
    id: "customisation",
    label: "Customisation",
    group: APPEARANCE_GROUP,
    pageTitle: "Customise Chat",
    component: ProfileCustomisationTab,
  },
  {
    id: "pets",
    label: "Pets",
    group: APPEARANCE_GROUP,
    pageTitle: "Your pet",
    component: ProfilePetsTab,
  },
  {
    id: "providers",
    label: "Providers",
    group: MODELS_GROUP,
    pageTitle: "Available Providers",
    component: ProfileProvidersTab,
  },
  { id: "api-keys", label: "API keys", group: MODELS_GROUP, component: ProfileApiKeysTab },
  { id: "sandbox", label: "Sandbox", group: ADVANCED_GROUP, component: ProfileSandboxTab },
  { id: "training", label: "Training", group: ADVANCED_GROUP, component: ProfileTrainingTab },
];

interface ProfileSidebarProps {
  activeItemId: string;
  onSelectItem: (id: string) => void;
}

export function ProfileSidebar({ activeItemId, onSelectItem }: ProfileSidebarProps) {
  const { sidebarVisible, isMobile, setSidebarVisible } = useUIStore();
  const { isAuthenticated, logout, isLoggingOut } = useAuthStatus();

  return (
    <AccountSidebarShell
      sections={profileSidebarItems.map(({ id, label, group }) => ({ id, label, group }))}
      activeSectionId={activeItemId}
      onSelectSection={onSelectItem}
      homeHref="/"
      header={<SidebarHeader />}
      footer={<SidebarFooter />}
      isMobile={isMobile}
      sidebarVisible={sidebarVisible}
      onClose={() => setSidebarVisible(false)}
      isAuthenticated={isAuthenticated}
      isLoggingOut={isLoggingOut}
      onLogout={() => logout()}
    />
  );
}
