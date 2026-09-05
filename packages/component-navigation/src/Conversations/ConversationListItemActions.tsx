import {
  OptionsMenu,
  OptionsMenuAction,
  OptionsMenuRadioGroup,
  OptionsMenuSeparator,
  OptionsMenuSubmenu,
} from "@ngriffin_uk/polychat-component-ui";
import type { ConversationGroup, ConversationSnooze } from "@ngriffin_uk/polychat-schemas";
import {
  AlarmClock,
  Edit,
  FolderInput,
  Mail,
  MailOpen,
  MoreHorizontal,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";

export type ConversationSnoozeChoice = "tomorrow" | "next_response";

export interface ConversationOrganisationActions {
  isPinned: boolean;
  isUnread: boolean;
  snooze?: ConversationSnooze | null;
  group?: ConversationGroup | null;
  availableGroups?: ConversationGroup[];
  canManageGroups: boolean;
  onTogglePinned: () => void;
  onToggleUnread: () => void;
  onSnooze: (choice: ConversationSnoozeChoice | null) => void;
  onMoveToGroup: (groupId: string | null) => void;
  onManageGroups: () => void;
}

export interface ConversationListItemActionsProps {
  conversationId: string;
  title: string;
  organisation?: ConversationOrganisationActions;
  onOpenChange?: (open: boolean) => void;
  onEditTitle: (conversationId: string, currentTitle: string) => void;
  onDelete: (conversationId: string) => void;
}

const NO_GROUP = "__none__";

function groupOptions(groups: ConversationGroup[]) {
  return [
    { value: NO_GROUP, label: "No group" },
    ...groups.map((group) => ({ value: group.id, label: group.name })),
  ];
}

export function ConversationListItemActions({
  conversationId,
  title,
  organisation,
  onOpenChange,
  onEditTitle,
  onDelete,
}: ConversationListItemActionsProps) {
  return (
    <div
      data-hover-actions=""
      className="absolute right-2 z-20 flex items-center bg-inherit opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:has-[[data-state=open]]:opacity-100"
    >
      <OptionsMenu
        align="end"
        onOpenChange={onOpenChange}
        trigger={
          <button
            type="button"
            className="text-muted-foreground hover:bg-selection hover:text-foreground data-[state=open]:bg-selection data-[state=open]:text-foreground focus-visible:outline-ring flex size-8 items-center justify-center rounded-lg border-0 transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="Conversation actions"
            title="Conversation actions"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        }
      >
        {organisation && (
          <>
            <OptionsMenuAction shortcut="P" onSelect={organisation.onTogglePinned}>
              {organisation.isPinned ? (
                <PinOff size={14} className="mr-2 shrink-0" aria-hidden="true" />
              ) : (
                <Pin size={14} className="mr-2 shrink-0" aria-hidden="true" />
              )}
              {organisation.isPinned ? "Unpin" : "Pin"}
            </OptionsMenuAction>
            <OptionsMenuAction shortcut="U" onSelect={organisation.onToggleUnread}>
              {organisation.isUnread ? (
                <MailOpen size={14} className="mr-2 shrink-0" aria-hidden="true" />
              ) : (
                <Mail size={14} className="mr-2 shrink-0" aria-hidden="true" />
              )}
              {organisation.isUnread ? "Mark as read" : "Mark as unread"}
            </OptionsMenuAction>
            <OptionsMenuSubmenu
              trigger={
                <span className="flex items-center">
                  <AlarmClock size={14} className="mr-2 shrink-0" aria-hidden="true" />
                  Snooze
                </span>
              }
            >
              <OptionsMenuAction onSelect={() => organisation.onSnooze("tomorrow")}>
                Until tomorrow
              </OptionsMenuAction>
              <OptionsMenuAction onSelect={() => organisation.onSnooze("next_response")}>
                Until next response
              </OptionsMenuAction>
              {organisation.snooze && (
                <>
                  <OptionsMenuSeparator />
                  <OptionsMenuAction onSelect={() => organisation.onSnooze(null)}>
                    Clear snooze
                  </OptionsMenuAction>
                </>
              )}
            </OptionsMenuSubmenu>
            <OptionsMenuSubmenu
              trigger={
                <span className="flex items-center">
                  <FolderInput size={14} className="mr-2 shrink-0" aria-hidden="true" />
                  Move to group
                </span>
              }
            >
              {organisation.availableGroups ? (
                <OptionsMenuRadioGroup
                  value={organisation.group?.id ?? NO_GROUP}
                  options={groupOptions(organisation.availableGroups)}
                  onChange={(value) =>
                    organisation.onMoveToGroup(value === NO_GROUP ? null : value)
                  }
                />
              ) : (
                <OptionsMenuAction disabled onSelect={() => undefined}>
                  Loading groups…
                </OptionsMenuAction>
              )}
              {organisation.canManageGroups && (
                <>
                  <OptionsMenuSeparator />
                  <OptionsMenuAction onSelect={organisation.onManageGroups}>
                    Manage groups…
                  </OptionsMenuAction>
                </>
              )}
            </OptionsMenuSubmenu>
            <OptionsMenuSeparator />
          </>
        )}
        <OptionsMenuAction shortcut="R" onSelect={() => onEditTitle(conversationId, title)}>
          <Edit size={14} className="mr-2 shrink-0" aria-hidden="true" />
          Rename
        </OptionsMenuAction>
        <OptionsMenuSeparator />
        <OptionsMenuAction
          shortcut="D"
          className="text-destructive data-[highlighted]:text-destructive"
          onSelect={() => onDelete(conversationId)}
        >
          <Trash2 size={14} className="mr-2 shrink-0" aria-hidden="true" />
          Delete
        </OptionsMenuAction>
      </OptionsMenu>
    </div>
  );
}
