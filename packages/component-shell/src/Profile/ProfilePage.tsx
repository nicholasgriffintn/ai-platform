import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { getRetiredProfileTabPath, useAuthStatus } from "@ngriffin_uk/polychat-library-react";
import { Loader2 } from "lucide-react";
import { Navigate, useSearchParams } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState";
import { PageShell } from "../Shell/PageShell";
import { ProfileSidebar, profileSidebarItems } from "./ProfileSidebar";

export function ProfilePage() {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTabId = searchParams.get("tab") || profileSidebarItems[0].id;
  const activeItem = profileSidebarItems.find((item) => item.id === activeTabId);
  const ActiveComponent = activeItem?.component;
  const retiredTabPath = activeItem ? undefined : getRetiredProfileTabPath(activeTabId);

  if (retiredTabPath) {
    return <Navigate to={retiredTabPath} replace />;
  }

  return (
    <PageShell
      title={activeItem?.pageTitle ?? activeItem?.label ?? "Profile"}
      sidebarContent={
        <ProfileSidebar
          activeItemId={activeTabId}
          onSelectItem={(id) => setSearchParams({ tab: id })}
        />
      }
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
