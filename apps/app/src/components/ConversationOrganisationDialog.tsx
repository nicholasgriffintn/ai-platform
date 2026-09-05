import { ConversationOrganisationDialog as ControlledConversationOrganisationDialog } from "@ngriffin_uk/polychat-component-navigation";
import type { ConversationLabelScope } from "@ngriffin_uk/polychat-schemas";

import { useConversationOrganisation } from "~/hooks/useConversationOrganisation";
import { nextLocalMorning } from "~/lib/conversation-organisation";

interface ConversationOrganisationDialogProps {
  conversationId: string | null;
  projectId?: string;
  canManageLabels: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConversationOrganisationDialog({
  conversationId,
  projectId,
  canManageLabels,
  onOpenChange,
}: ConversationOrganisationDialogProps) {
  const organisation = useConversationOrganisation(conversationId, projectId);
  const scope: ConversationLabelScope = projectId
    ? { kind: "project", projectId }
    : { kind: "personal" };

  return (
    <ControlledConversationOrganisationDialog
      open={conversationId !== null}
      organisation={organisation.query.data}
      isLoading={organisation.query.isLoading}
      isSaving={organisation.isSaving}
      canManageLabels={canManageLabels}
      tomorrowAt={nextLocalMorning()}
      onOpenChange={onOpenChange}
      onUpdate={(change) => organisation.update.mutate(change)}
      onSetLabel={(labelId, assigned) => organisation.assignment.mutate({ labelId, assigned })}
      onCreateLabel={(name) => organisation.createLabel.mutate({ name, scope })}
      onDeleteLabel={(label) => organisation.deleteLabel.mutate(label)}
    />
  );
}
