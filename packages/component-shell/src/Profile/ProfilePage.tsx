import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { useAuthStatus } from "@ngriffin_uk/polychat-library-react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "react-router";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";
import {
  extendProfileSidebarItems,
  ProfileSidebar,
  type ProfileSidebarItem,
} from "./ProfileSidebar.js";

export interface ProfilePageProps {
  additionalItems?: readonly ProfileSidebarItem[];
}

export function ProfilePage({ additionalItems = [] }: ProfilePageProps) {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const sidebarItems = extendProfileSidebarItems(additionalItems);

  const activeTabId = searchParams.get("tab") || sidebarItems[0].id;
  const activeItem = sidebarItems.find((item) => item.id === activeTabId);
  const ActiveComponent = activeItem?.component;

  return (
    <PageShell
      title={activeItem?.pageTitle ?? activeItem?.label ?? "Profile"}
      sidebarContent={
        <ProfileSidebar
          items={sidebarItems}
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
