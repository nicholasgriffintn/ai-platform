import { AccountSidebarShell } from "@ngriffin_uk/polychat-component-account";

import { useAuthStatus } from "~/hooks/useAuth";
import { useUIStore } from "~/state/stores/uiStore";

import { SidebarFooter } from "../Sidebar/SidebarFooter";
import { SidebarHeader } from "../Sidebar/SidebarHeader";
import { ProfileAccountTab } from "./Tabs/ProfileAccountTab";
import { ProfileApiKeysTab } from "./Tabs/ProfileApiKeysTab";
import { ProfileBillingTab } from "./Tabs/ProfileBillingTab";
import { ProfileCustomisationTab } from "./Tabs/ProfileCustomisationTab";
import { ProfileHistoryTab } from "./Tabs/ProfileHistoryTab";
import { ProfilePasskeysTab } from "./Tabs/ProfilePasskeysTab";
import { ProfilePetsTab } from "./Tabs/ProfilePetsTab";
import { ProfileProvidersTab } from "./Tabs/ProfileProvidersTab";
import { ProfileSandboxTab } from "./Tabs/ProfileSandboxTab";
import { ProfileSourcesTab } from "./Tabs/ProfileSourcesTab";
import { ProfileTasksTab } from "./Tabs/ProfileTasksTab";

interface ProfileSidebarItem {
  id: string;
  label: string;
  pageTitle?: string;
  component: React.FC;
}

export const profileSidebarItems: ProfileSidebarItem[] = [
  { id: "account", label: "Account", component: ProfileAccountTab },
  { id: "passkeys", label: "Passkeys", component: ProfilePasskeysTab },
  {
    id: "customisation",
    label: "Customisation",
    pageTitle: "Customise Chat",
    component: ProfileCustomisationTab,
  },
  {
    id: "pets",
    label: "Pets",
    pageTitle: "Your pet",
    component: ProfilePetsTab,
  },
  { id: "history", label: "Chat History", component: ProfileHistoryTab },
  {
    id: "providers",
    label: "Providers",
    pageTitle: "Available Providers",
    component: ProfileProvidersTab,
  },
  { id: "sandbox", label: "Sandbox", component: ProfileSandboxTab },
  { id: "billing", label: "Billing", component: ProfileBillingTab },
  { id: "api-keys", label: "API Keys", component: ProfileApiKeysTab },
  { id: "tasks", label: "Tasks", component: ProfileTasksTab },
  { id: "sources", label: "Sources", component: ProfileSourcesTab },
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
      sections={profileSidebarItems.map(({ id, label }) => ({ id, label }))}
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
