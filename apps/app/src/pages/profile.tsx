import { Loader2 } from "lucide-react";
import { useSearchParams } from "react-router";

import { PageShell } from "~/components/PageShell";
import { PageStatus } from "~/components/PageStatus";
import {
  ProfileSidebar,
  profileSidebarItems,
} from "~/components/Profile/ProfileSidebar";
import { Button } from "~/components/ui/Button";
import { useAuthStatus } from "~/hooks/useAuth";
import { useChatStore } from "~/state/stores/chatStore";

export function meta() {
  return [
    { title: "Profile - Polychat" },
    { name: "description", content: "Manage your account and preferences" },
  ];
}

export default function ProfilePage() {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setShowLoginModal } = useChatStore();

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
    <PageShell sidebarContent={sidebar} className="max-w-6xl mx-auto px-4 py-8">
      {isLoading ? (
        <PageStatus
          icon={<Loader2 size={32} className="animate-spin text-blue-600" />}
          message="Loading profile data..."
          className="h-auto min-h-[200px]"
        />
      ) : !isAuthenticated ? (
        <PageStatus
          message="You need to log in to view your profile."
          className="h-auto min-h-[200px]"
        >
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowLoginModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Login
          </Button>
        </PageStatus>
      ) : ActiveComponent ? (
        <ActiveComponent />
      ) : (
        <PageStatus
          message="Selected tab content not found."
          className="h-auto min-h-[200px]"
        />
      )}
    </PageShell>
  );
}
