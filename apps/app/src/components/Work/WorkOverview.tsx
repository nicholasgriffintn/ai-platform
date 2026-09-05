import { Button, CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  TaskAttentionList,
  WorkAccessEmptyState,
  WorkspaceCardGrid,
} from "@ngriffin_uk/polychat-component-workspaces";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { useState } from "react";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useTaskAttention } from "~/hooks/useProjectTasks";
import { isAuthenticationError } from "~/lib/errors";
import { useChatStore } from "~/state/stores/chatStore";

import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { useWorkData } from "./WorkDataContext";

export function WorkOverview() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { workspacesQuery } = useWorkData();
  const { data, isLoading, error } = workspacesQuery;
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const isPro = useChatStore((state) => state.isPro);
  const canAccessWork = isAuthenticated && isPro;
  const { items: attentionItems } = useTaskAttention();

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
        <p className="mb-6 text-sm text-muted-foreground">Create and manage shared workspaces.</p>

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

        {canAccessWork && data?.workspaces.length === 0 && (
          <EmptyState
            icon={<BriefcaseBusiness className="text-muted-foreground" size={24} />}
            title="No workspaces yet"
            message="Create a workspace to organise projects and invite other people."
            action={<Button onClick={() => setIsCreateOpen(true)}>Create workspace</Button>}
            className="min-h-[260px]"
          />
        )}

        {canAccessWork && data?.workspaces.length ? (
          <WorkspaceCardGrid
            workspaces={data.workspaces.map((workspace) => ({
              ...workspace,
              href: `/work/${workspace.id}`,
            }))}
          />
        ) : null}

        {canAccessWork && attentionItems.length > 0 && (
          <section className="mt-10">
            <h2 className="text-foreground mb-3 text-sm font-semibold">Waiting on you</h2>
            <TaskAttentionList
              items={attentionItems}
              itemHref={(item) =>
                `/work/${item.workspaceId}/projects/${item.projectId}/tasks/${item.taskId}`
              }
            />
          </section>
        )}
      </PageShell.Content>
      <CreateWorkspaceDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  );
}
