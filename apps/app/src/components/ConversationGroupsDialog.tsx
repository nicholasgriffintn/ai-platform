import { ConversationGroupsDialog as ControlledConversationGroupsDialog } from "@ngriffin_uk/polychat-component-navigation";
import type { ConversationGroupScope } from "@ngriffin_uk/polychat-schemas";

import { useConversationOrganisation } from "~/hooks/useConversationOrganisation";

interface ConversationGroupsDialogProps {
  conversationId: string | null;
  projectId?: string;
  canManageGroups: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConversationGroupsDialog({
  conversationId,
  projectId,
  canManageGroups,
  onOpenChange,
}: ConversationGroupsDialogProps) {
  const organisation = useConversationOrganisation(conversationId, projectId);
  const scope: ConversationGroupScope = projectId
    ? { kind: "project", projectId }
    : { kind: "personal" };

  return (
    <ControlledConversationGroupsDialog
      open={conversationId !== null}
      currentGroup={organisation.query.data?.group}
      availableGroups={organisation.query.data?.availableGroups}
      isLoading={organisation.query.isLoading}
      isSaving={organisation.isSaving}
      canManageGroups={canManageGroups}
      onOpenChange={onOpenChange}
      onMoveToGroup={(groupId) => organisation.move.mutate(groupId)}
      onCreateGroup={(name) =>
        organisation.createGroup.mutate(
          { name, scope },
          { onSuccess: (group) => organisation.move.mutate(group.id) },
        )
      }
      onDeleteGroup={(group) => organisation.deleteGroup.mutate(group)}
    />
  );
}
