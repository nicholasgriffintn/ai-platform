import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@ngriffin_uk/polychat-component-ui";
import type { ConversationGroup } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export interface ConversationGroupsDialogProps {
  open: boolean;
  currentGroup?: ConversationGroup | null;
  availableGroups?: ConversationGroup[];
  isLoading?: boolean;
  isSaving?: boolean;
  canManageGroups: boolean;
  onOpenChange: (open: boolean) => void;
  onMoveToGroup: (groupId: string | null) => void;
  onCreateGroup: (name: string) => void;
  onDeleteGroup: (group: ConversationGroup) => void;
}

export function ConversationGroupsDialog({
  open,
  currentGroup,
  availableGroups,
  isLoading = false,
  isSaving = false,
  canManageGroups,
  onOpenChange,
  onMoveToGroup,
  onCreateGroup,
  onDeleteGroup,
}: ConversationGroupsDialogProps) {
  const [groupName, setGroupName] = useState("");

  const createGroup = () => {
    const name = groupName.trim();

    if (!name) {
      return;
    }

    onCreateGroup(name);
    setGroupName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Groups</DialogTitle>
          <DialogDescription>
            Move this conversation into a group, or manage the groups available here. Groups never
            change who can access a conversation.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !availableGroups ? (
          <p className="text-muted-foreground py-6 text-sm">Loading groups…</p>
        ) : (
          <div className="space-y-3">
            {availableGroups.length === 0 ? (
              <p className="text-muted-foreground text-sm">No groups yet.</p>
            ) : (
              <ul className="space-y-1">
                {availableGroups.map((group) => {
                  const isCurrent = currentGroup?.id === group.id;

                  return (
                    <li
                      key={group.id}
                      className="hover:bg-muted flex items-center gap-2 rounded p-2"
                    >
                      <Checkbox
                        checked={isCurrent}
                        disabled={isSaving}
                        aria-label={`Move to ${group.name}`}
                        onCheckedChange={(checked) =>
                          onMoveToGroup(checked === true ? group.id : null)
                        }
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{group.name}</span>
                      {canManageGroups && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => onDeleteGroup(group)}
                        >
                          Delete
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canManageGroups && (
              <div className="flex gap-2 pt-1">
                <Input
                  value={groupName}
                  maxLength={40}
                  placeholder="New group"
                  aria-label="New group name"
                  onChange={(event) => setGroupName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      createGroup();
                    }
                  }}
                />
                <Button
                  type="button"
                  disabled={isSaving || !groupName.trim()}
                  onClick={createGroup}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
