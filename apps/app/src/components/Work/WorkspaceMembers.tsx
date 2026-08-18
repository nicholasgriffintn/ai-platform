import { ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import {
  WorkspaceInvitationList,
  WorkspaceMemberList,
  WorkspaceMembersSkeleton,
} from "@ngriffin_uk/polychat-component-workspaces";
import { LogOut, UserPlus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useAuthStatus } from "~/hooks/useAuth";
import { useWorkspaceMemberMutations } from "~/hooks/useGovernance";
import { useRevokeWorkspaceInvitation } from "~/hooks/useWorkspaces";
import { isAuthenticationError } from "~/lib/errors";

import { InviteMemberDialog } from "./InviteMemberDialog";
import { useWorkData } from "./WorkContext";

export function WorkspaceMembers({ workspaceId }: { workspaceId: string }) {
  const { workspaceQuery } = useWorkData();
  const { data: workspace, isLoading, error } = workspaceQuery;
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [removeUserId, setRemoveUserId] = useState<number | null>(null);
  const [transferUserId, setTransferUserId] = useState<number | null>(null);
  const revokeInvitation = useRevokeWorkspaceInvitation();
  const memberMutations = useWorkspaceMemberMutations(workspaceId);
  const { user } = useAuthStatus();
  const navigate = useNavigate();

  if (isLoading) {
    return <WorkspaceMembersSkeleton />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view workspace people"
        message="Sign in to manage workspace access and members."
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
  const currentUserId = user?.id ? Number(user.id) : undefined;
  const headerActions = [
    ...(canManage
      ? [
          {
            label: "Invite person",
            icon: <UserPlus size={16} />,
            onClick: () => setIsInviteOpen(true),
          },
        ]
      : []),
    ...(workspace.role !== "owner"
      ? [
          {
            label: "Leave workspace",
            icon: <LogOut size={16} />,
            variant: "secondary" as const,
            onClick: () => setIsLeaveOpen(true),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageShell.Content className="max-w-5xl">
        <PageShell.Header title="People & access" actions={headerActions} />
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Manage access to {workspace.name}.
        </p>
        <WorkspaceMemberList
          members={workspace.members}
          viewerRole={workspace.role}
          viewerUserId={currentUserId}
          onChangeRole={(userId, role) => memberMutations.updateRole.mutate({ userId, role })}
          onRemove={setRemoveUserId}
          onTransferOwnership={setTransferUserId}
        />

        {canManage && (
          <WorkspaceInvitationList
            invitations={workspace.invitations.filter((invite) => invite.status === "pending")}
            revokingInvitationId={
              revokeInvitation.isPending ? revokeInvitation.variables?.invitationId : null
            }
            onRevoke={(invitationId) => revokeInvitation.mutate({ workspaceId, invitationId })}
          />
        )}
      </PageShell.Content>
      <InviteMemberDialog
        workspaceId={workspaceId}
        canInviteAdmin={workspace.role === "owner"}
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
      />
      <ConfirmationDialog
        open={isLeaveOpen}
        onOpenChange={setIsLeaveOpen}
        title="Leave workspace"
        description={`Leave ${workspace.name}? You will lose access to its projects and conversations.`}
        confirmText="Leave workspace"
        variant="destructive"
        isLoading={memberMutations.leave.isPending}
        onConfirm={async () => {
          await memberMutations.leave.mutateAsync();
          void navigate("/work");
        }}
      />
      <ConfirmationDialog
        open={removeUserId !== null}
        onOpenChange={(open) => !open && setRemoveUserId(null)}
        title="Remove workspace member"
        description="Remove this person from the workspace and all of its projects?"
        confirmText="Remove member"
        variant="destructive"
        onConfirm={async () => {
          if (removeUserId !== null) {
            await memberMutations.remove.mutateAsync(removeUserId);
          }

          setRemoveUserId(null);
        }}
      />
      <ConfirmationDialog
        open={transferUserId !== null}
        onOpenChange={(open) => !open && setTransferUserId(null)}
        title="Transfer workspace ownership"
        description="The new owner will receive full control and your role will become administrator."
        confirmText="Transfer ownership"
        onConfirm={async () => {
          if (transferUserId !== null) {
            await memberMutations.transfer.mutateAsync(transferUserId);
          }

          setTransferUserId(null);
        }}
      />
    </>
  );
}
