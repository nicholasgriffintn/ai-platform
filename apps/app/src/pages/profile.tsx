import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { LoginModal } from "~/components/LoginModal";
import {
  ProfileSidebar,
  profileSidebarItems,
} from "~/components/Profile/ProfileSidebar";
import { Button } from "~/components/ui/Button";
import { useAuthStatus } from "~/hooks/useAuth";
import { SidebarLayout } from "~/layouts/SidebarLayout";

export function meta() {
  return [
    { title: "Profile" },
    { name: "description", content: "User profile" },
  ];
}

export default function ProfilePage() {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTabId = searchParams.get("tab") || profileSidebarItems[0].id;

  const ActiveComponent = profileSidebarItems.find(
    (item) => item.id === activeTabId,
  )?.component;

  const handleSelectItem = (id: string) => {
    setSearchParams({ tab: id });
  };

  const sidebar = (
    <ProfileSidebar
      activeItemId={activeTabId}
      onSelectItem={handleSelectItem}
    />
  );

  return (
    <SidebarLayout sidebarContent={sidebar}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Loading profile data...
            </p>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              You need to log in to view your profile.
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Login
            </Button>
          </div>
        ) : ActiveComponent ? (
          <ActiveComponent />
        ) : (
          <div>Selected tab content not found.</div>
        )}
      </div>
      <LoginModal
        open={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
        onKeySubmit={() => setIsLoginModalOpen(false)}
      />
    </SidebarLayout>
  );
}
