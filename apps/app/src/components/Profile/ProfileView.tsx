import { useState } from "react";

import { Button } from "~/components/ui/Button";
import { useAuthStatus } from "~/hooks/useAuth";
import { cn } from "~/lib/utils";
import { ProfileAccountTab } from "./Tabs/ProfileAccountTab";
import { ProfileCustomisationTab } from "./Tabs/ProfileCustomisationTab";
import { ProfileHistoryTab } from "./Tabs/ProfileHistoryTab";
import { ProfilePasskeysTab } from "./Tabs/ProfilePasskeysTab";
import { ProfileProvidersTab } from "./Tabs/ProfileProvidersTab";

export function ProfileView() {
  const { user, logout, isLoggingOut } = useAuthStatus();
  const [activeTab, setActiveTab] = useState("account");

  const handleLogout = () => {
    logout();
  };

  const tabs = [
    { id: "account", label: "Account" },
    { id: "passkeys", label: "Passkeys" },
    { id: "customisation", label: "Customisation" },
    { id: "history", label: "Chat History" },
    { id: "providers", label: "Providers" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="flex flex-col items-center md:col-span-1">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user?.name || "Your Account"}
              className="w-32 h-32 rounded-full object-cover mb-2 border-2 border-indigo-500"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-indigo-500 flex items-center justify-center text-white text-5xl font-semibold mb-2">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
            {user?.name || "Your Account"}
          </h2>
          {user?.email && (
            <p className="text-zinc-500 dark:text-zinc-400">{user?.email}</p>
          )}
          {user?.github_username && (
            <p className="text-zinc-500 dark:text-zinc-400">
              <a
                href={`https://github.com/${user.github_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-700 dark:text-zinc-300"
              >
                @{user.github_username}
              </a>
            </p>
          )}
          <div className="mt-2 px-3 py-1 bg-zinc-200 dark:bg-zinc-700 rounded-full text-sm text-zinc-700 dark:text-zinc-300">
            {user?.plan_id === "pro" ? "Pro Plan" : "Free Plan"}
          </div>

          <div className="pt-4 mt-6">
            <Button
              variant="destructive"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </Button>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="border-b border-zinc-200 dark:border-zinc-700 mb-6">
            <div className="flex flex-wrap -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    "inline-block px-4 py-2 text-sm font-medium rounded-t-lg",
                    activeTab === tab.id
                      ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300",
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
            {activeTab === "account" && <ProfileAccountTab />}

            {activeTab === "passkeys" && <ProfilePasskeysTab />}

            {activeTab === "customisation" && <ProfileCustomisationTab />}

            {activeTab === "history" && <ProfileHistoryTab />}

            {activeTab === "providers" && <ProfileProvidersTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
