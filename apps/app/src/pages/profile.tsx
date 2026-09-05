import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { Loader2 } from "lucide-react";
import { Navigate, useSearchParams } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { ProfileSidebar, profileSidebarItems } from "~/components/Profile/ProfileSidebar";
import { useAuthStatus } from "~/hooks/useAuth";
import { getRetiredProfileTabPath } from "~/lib/profile-tabs";

export function meta() {
  return [
    { title: "Profile - Polychat" },
    { name: "description", content: "Manage your account and preferences" },
  ];
}

export default function ProfilePage() {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTabId = searchParams.get("tab") || profileSidebarItems[0].id;

  const activeItem = profileSidebarItems.find((item) => item.id === activeTabId);
  const ActiveComponent = activeItem?.component;
  const retiredTabPath = activeItem ? undefined : getRetiredProfileTabPath(activeTabId);

  const handleSelectItem = (id: string) => {
    setSearchParams({ tab: id });
  };

  if (retiredTabPath) {
    return <Navigate to={retiredTabPath} replace />;
  }

  const sidebar = <ProfileSidebar activeItemId={activeTabId} onSelectItem={handleSelectItem} />;

  return (
    <PageShell
      title={activeItem?.pageTitle ?? activeItem?.label ?? "Profile"}
      sidebarContent={sidebar}
      className="max-w-6xl"
    >
      {isLoading ? (
        <PageStatus
          icon={<Loader2 size={32} className="animate-spin text-active-work" />}
          message="Loading profile data..."
          className="h-auto min-h-[200px]"
        />
      ) : !isAuthenticated ? (
        <SignInEmptyState
          title="Sign in to view your profile"
          message="Sign in to manage your account, preferences, and Polychat settings."
          className="h-auto min-h-[200px]"
        />
      ) : ActiveComponent ? (
        <ActiveComponent />
      ) : (
        <PageStatus message="Selected tab content not found." className="h-auto min-h-[200px]" />
      )}
    </PageShell>
  );
}
