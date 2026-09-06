import {
  ConversationListItemActions,
  type ConversationSummary,
} from "@ngriffin_uk/polychat-component-navigation";
import { useState } from "react";

import { useConversationOrganisation } from "~/hooks/useConversationOrganisation";
import { resolveSnoozeChoice } from "~/lib/conversation-organisation";

interface ConversationItemActionsProps {
  conversation: ConversationSummary & { id: string };
  projectId?: string;
  canOrganise: boolean;
  canManageGroups: boolean;
  onEditTitle: (conversationId: string, currentTitle: string) => void;
  onDelete: (conversationId: string) => void;
  onManageGroups: (conversationId: string) => void;
}

export function ConversationItemActions({
  conversation,
  projectId,
  canOrganise,
  canManageGroups,
  onEditTitle,
  onDelete,
  onManageGroups,
}: ConversationItemActionsProps) {
  const [hasOpened, setHasOpened] = useState(false);
  const organisation = useConversationOrganisation(
    canOrganise && hasOpened ? conversation.id : null,
    projectId,
  );
  const current = organisation.query.data;
  const isPinned = current?.isPinned ?? conversation.isPinned ?? false;
  const isUnread = current?.isUnread ?? conversation.isUnread ?? false;

  return (
    <ConversationListItemActions
      conversationId={conversation.id}
      title={conversation.title || ""}
      onOpenChange={(open) => {
        if (open) {
          setHasOpened(true);
        }
      }}
      organisation={
        canOrganise
          ? {
              isPinned,
              isUnread,
              snooze: current?.snooze,
              group: current?.group ?? conversation.group,
              availableGroups: current?.availableGroups,
              canManageGroups,
              onTogglePinned: () => organisation.update.mutate({ isPinned: !isPinned }),
              onToggleUnread: () => organisation.update.mutate({ isUnread: !isUnread }),
              onSnooze: (choice) =>
                organisation.update.mutate({ snooze: resolveSnoozeChoice(choice) }),
              onMoveToGroup: (groupId) => organisation.move.mutate(groupId),
              onManageGroups: () => onManageGroups(conversation.id),
            }
          : undefined
      }
      onEditTitle={onEditTitle}
      onDelete={onDelete}
    />
  );
}
