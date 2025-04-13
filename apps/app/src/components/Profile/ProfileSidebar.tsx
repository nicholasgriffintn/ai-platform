import { useState } from "react";

import { useChatStore } from "~/state/stores/chatStore";
import { LoginModal } from "../LoginModal";
import { SidebarFooter } from "../Sidebar/SidebarFooter";
import { SidebarHeader } from "../Sidebar/SidebarHeader";
import { ProfileAccountTab } from "./Tabs/ProfileAccountTab";
import { ProfileApiKeysTab } from "./Tabs/ProfileApiKeysTab";
import { ProfileCustomisationTab } from "./Tabs/ProfileCustomisationTab";
import { ProfileHistoryTab } from "./Tabs/ProfileHistoryTab";
import { ProfilePasskeysTab } from "./Tabs/ProfilePasskeysTab";
import { ProfileProvidersTab } from "./Tabs/ProfileProvidersTab";

interface ProfileSidebarItem {
  id: string;
  label: string;
  component: React.FC;
}

export const profileSidebarItems: ProfileSidebarItem[] = [
  { id: "account", label: "Account", component: ProfileAccountTab },
  { id: "passkeys", label: "Passkeys", component: ProfilePasskeysTab },
  {
    id: "customisation",
    label: "Customisation",
    component: ProfileCustomisationTab,
  },
  { id: "history", label: "Chat History", component: ProfileHistoryTab },
  { id: "providers", label: "Providers", component: ProfileProvidersTab },
  { id: "api-keys", label: "API Keys", component: ProfileApiKeysTab },
];

interface ProfileSidebarProps {
  activeItemId: string;
  onSelectItem: (id: string) => void;
}

export function ProfileSidebar({
  activeItemId,
  onSelectItem,
}: ProfileSidebarProps) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const handleOpenLoginModal = () => setIsLoginModalOpen(true);
  const { sidebarVisible, isMobile, setSidebarVisible } = useChatStore();

  return (
    <>
      {sidebarVisible && isMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-20"
          onClick={() => setSidebarVisible(false)}
          onKeyDown={(e) => e.key === "Enter" && setSidebarVisible(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed md:relative z-50 h-full w-64 bg-off-white dark:bg-zinc-900 transition-transform duration-300 ease-in-out border-r border-zinc-200 dark:border-zinc-800 ${sidebarVisible ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:border-0"}`}
      >
        {sidebarVisible && (
          <div className="flex flex-col h-full w-64 overflow-hidden">
            <SidebarHeader showCloudButton={false} />
            <nav className="flex-1 overflow-y-auto p-2 pb-[50px]">
              <ul className="space-y-1">
                {profileSidebarItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectItem(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out
                        ${
                          activeItemId === item.id
                            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <SidebarFooter
              onOpenLoginModal={handleOpenLoginModal}
              enableClearAllMessages={false}
            />
          </div>
        )}
      </div>
      <LoginModal
        open={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
        onKeySubmit={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
