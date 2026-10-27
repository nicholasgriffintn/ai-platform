import {
  Button,
  CardGridLoadingSkeleton,
  EmptyState,
  SegmentedControl,
} from "@ngriffin_uk/polychat-component-ui";
import {
  WorkAccessEmptyState,
  WorkspaceCardGrid,
} from "@ngriffin_uk/polychat-component-workspaces";
import { isAuthenticationError, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { useState } from "react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { useShellHost } from "../Host/ShellHostContext.js";
import { PageShell } from "../Shell/PageShell.js";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog.js";
import { useViewParam } from "./useViewParam.js";
import { useWorkData } from "./WorkDataContext.js";

type WorkOverviewView = "workspaces" | "notifications";

function readWorkOverviewView(value: string | null): WorkOverviewView {
  return value === "notifications" ? value : "workspaces";
}

export function WorkOverview() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { workspacesQuery } = useWorkData();
  const { data, isLoading, error } = workspacesQuery;
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const isPro = useChatStore((state) => state.isPro);
  const canAccessWork = isAuthenticated && isPro;
  const [view, setView] = useViewParam<WorkOverviewView>(readWorkOverviewView, "workspaces");
  const { TaskNotificationSettings } = useShellHost();

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <PageShell.Header
          title="Workspaces"
          actions={
            canAccessWork
              ? [
                  {
                    label: "New workspace",
                    icon: <Plus size={17} />,
                    onClick: () => setIsCreateOpen(true),
                  },
                ]
              : undefined
          }
        />

        {isAuthenticationLoading ? (
          <CardGridLoadingSkeleton
            count={6}
            label="Loading workspaces"
            gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
          />
        ) : !canAccessWork ? (
          isAuthenticated ? (
            <WorkAccessEmptyState />
          ) : (
            <SignInEmptyState
              title="Bring your projects together."
              message="Sign in to create a shared home for projects, conversations, and the people you work with."
              className="min-h-[300px]"
            />
          )
        ) : isLoading ? (
          <CardGridLoadingSkeleton
            count={6}
            label="Loading workspaces"
            gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
          />
        ) : isAuthenticationError(error) ? (
          <SignInEmptyState
            title="Sign in to view your workspaces"
            message="Sign in to access your shared workspaces."
            className="min-h-[300px]"
          />
        ) : error ? (
          <EmptyState
            title="Workspaces unavailable"
            message={error.message}
            className="min-h-[260px]"
          />
        ) : null}

        {canAccessWork && view === "workspaces" && data?.length === 0 && (
          <EmptyState
            icon={<BriefcaseBusiness className="text-muted-foreground" size={24} />}
            title="No workspaces yet"
            message="Describe your organisation and a lead teammate proposes projects, a team and first tasks for you to approve."
            action={<Button onClick={() => setIsCreateOpen(true)}>New workspace</Button>}
            className="min-h-[260px]"
          />
        )}

        {canAccessWork ? (
          <SegmentedControl
            className="mb-6"
            label="Workspaces views"
            value={view}
            options={[
              { id: "workspaces", label: "Workspaces", count: data?.length },
              { id: "notifications", label: "Notifications" },
            ]}
            onChange={setView}
          />
        ) : null}

        {canAccessWork && view === "workspaces" && data?.length ? (
          <WorkspaceCardGrid
            workspaces={data.map((workspace) => ({
              ...workspace,
              href: `/work/${workspace.id}`,
            }))}
          />
        ) : null}

        {canAccessWork && view === "notifications" ? <TaskNotificationSettings /> : null}
      </PageShell.Content>
      <CreateWorkspaceDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  );
}
