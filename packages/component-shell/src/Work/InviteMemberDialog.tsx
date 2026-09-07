import { InviteMemberDialog as ControlledInviteMemberDialog } from "@ngriffin_uk/polychat-component-workspaces";
import { useInviteWorkspaceMember } from "@ngriffin_uk/polychat-library-react";

import { CopyButton } from "../Content/CopyButton.js";

export function InviteMemberDialog({
  workspaceId,
  canInviteAdmin,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  canInviteAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inviteMember = useInviteWorkspaceMember();

  return (
    <ControlledInviteMemberDialog
      canInviteAdmin={canInviteAdmin}
      open={open}
      inviteUrl={inviteMember.data?.inviteUrl}
      errorMessage={inviteMember.error?.message}
      isSubmitting={inviteMember.isPending}
      renderCopyControl={(value) => <CopyButton value={value} />}
      onOpenChange={onOpenChange}
      onReset={() => inviteMember.reset()}
      onSubmit={async (input) => {
        await inviteMember.mutateAsync({ workspaceId, input });
      }}
    />
  );
}
