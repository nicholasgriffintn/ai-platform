import { ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import {
  WorkspaceOverviewActions,
  WorkspaceOverviewSkeleton,
  WorkspaceProjectsSection,
} from "@ngriffin_uk/polychat-component-workspaces";
import { useState } from "react";
import { useNavigate } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useDeleteWorkspace } from "~/hooks/useWorkspaces";
import { isAuthenticationError } from "~/lib/errors";

import { CreateProjectDialog } from "./CreateProjectDialog";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { useWorkData } from "./WorkContext";

export function WorkspaceOverview({ workspaceId }: { workspaceId: string }) {
  const { workspaceQuery } = useWorkData();
  const { data: workspace, isLoading, error } = workspaceQuery;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const deleteWorkspace = useDeleteWorkspace();
  const navigate = useNavigate();

  if (isLoading) {
    return <WorkspaceOverviewSkeleton />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view this workspace"
        message="Sign in to access this workspace and its projects."
        className="mx-4 my-8 min-h-[300px]"
      />
    );
  }

  if (error || !workspace) {
    return (
      <div className="p-10 text-sm text-red-700">{error?.message ?? "Workspace not found"}</div>
    );
  }

  const canManage = workspace.role === "owner" || workspace.role === "admin";

  return (
    <>
      <PageShell.Content className="max-w-6xl">
        <PageShell.Header
          title={workspace.name}
          actionContent={
            canManage ? (
              <WorkspaceOverviewActions
                isOwner={workspace.role === "owner"}
                onCreateProject={() => setIsCreateOpen(true)}
                onDeleteWorkspace={() => setIsDeleteOpen(true)}
                onInvite={() => setIsInviteOpen(true)}
              />
            ) : undefined
          }
        />
        <p className="mb-6 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          {workspace.description || `Your role: ${workspace.role}`}
        </p>

        <WorkspaceProjectsSection
          projects={workspace.projects.map((project) => ({
            ...project,
            href: `/work/${workspaceId}/projects/${project.id}`,
          }))}
          memberCount={workspace.memberCount}
          membersHref={`/work/${workspaceId}/members`}
          canManage={canManage}
          onCreateProject={() => setIsCreateOpen(true)}
        />
      </PageShell.Content>
      <CreateProjectDialog
        workspaceId={workspaceId}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
      <InviteMemberDialog
        workspaceId={workspaceId}
        canInviteAdmin={workspace.role === "owner"}
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
      />
      <ConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete workspace"
        description={`Delete ${workspace.name} and all of its projects, conversations, and invitations. This cannot be undone.`}
        confirmText="Delete workspace"
        variant="destructive"
        isLoading={deleteWorkspace.isPending}
        onConfirm={async () => {
          await deleteWorkspace.mutateAsync(workspaceId);
          void navigate("/work", { replace: true });
        }}
      >
        {deleteWorkspace.error && (
          <p className="text-sm text-red-700 dark:text-red-400">{deleteWorkspace.error.message}</p>
        )}
      </ConfirmationDialog>
    </>
  );
}
