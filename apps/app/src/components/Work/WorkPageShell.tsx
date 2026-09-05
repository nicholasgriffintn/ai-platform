import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { WorkAccessEmptyState } from "@ngriffin_uk/polychat-component-workspaces";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { ConversationProductHeader } from "~/components/ConversationThread/ConversationProductHeader";
import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useChatStore } from "~/state/stores/chatStore";

import { useWorkData } from "./WorkDataContext";
import { WorkSidebar } from "./WorkSidebar";

export function WorkPageShell({
  children,
  workspaceId,
  projectId,
}: {
  children: ReactNode;
  workspaceId?: string;
  projectId?: string;
}) {
  const { pathname } = useLocation();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const isPro = useChatStore((state) => state.isPro);
  const { projectQuery } = useWorkData();
  const projectColour = projectQuery.data?.colour;
  const requiresAuthentication = Boolean(workspaceId || projectId);
  const isProjectConversation = Boolean(projectId) && pathname.endsWith("/chat");
  const content =
    requiresAuthentication && isAuthenticationLoading ? (
      <PageStatus message="Loading workspace…" className="h-full min-h-[360px]" />
    ) : requiresAuthentication && !isAuthenticated ? (
      <SignInEmptyState
        title="Sign in to continue"
        message="Sign in to access this workspace and its projects."
        className="min-h-[360px] border-0 bg-transparent dark:bg-transparent"
      />
    ) : requiresAuthentication && !isPro ? (
      <div className="p-4 sm:p-8">
        <WorkAccessEmptyState />
      </div>
    ) : (
      children
    );

  return (
    <PageShell
      title={isProjectConversation ? undefined : "Work"}
      headerContent={
        isProjectConversation ? (
          <ConversationProductHeader projectColour={projectColour} />
        ) : undefined
      }
      sidebarContent={<WorkSidebar workspaceId={workspaceId} projectId={projectId} />}
      fullBleed
      displayNavBar={false}
      projectColour={projectId ? projectColour : undefined}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div data-header-scroll-source className="min-h-0 flex-1 overflow-y-auto">
          {content}
        </div>
      </div>
    </PageShell>
  );
}
