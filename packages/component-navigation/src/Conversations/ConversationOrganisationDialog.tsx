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
import type {
  ConversationLabel,
  ConversationOrganisation,
  ConversationSnooze,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export interface ConversationOrganisationDialogProps {
  open: boolean;
  organisation?: ConversationOrganisation;
  isLoading?: boolean;
  isSaving?: boolean;
  canManageLabels: boolean;
  tomorrowAt: string;
  onOpenChange: (open: boolean) => void;
  onUpdate: (change: {
    isPinned?: boolean;
    isUnread?: boolean;
    snooze?: ConversationSnooze | null;
  }) => void;
  onSetLabel: (labelId: string, assigned: boolean) => void;
  onCreateLabel: (name: string) => void;
  onDeleteLabel: (label: ConversationLabel) => void;
}

export function ConversationOrganisationDialog({
  open,
  organisation,
  isLoading = false,
  isSaving = false,
  canManageLabels,
  tomorrowAt,
  onOpenChange,
  onUpdate,
  onSetLabel,
  onCreateLabel,
  onDeleteLabel,
}: ConversationOrganisationDialogProps) {
  const [labelName, setLabelName] = useState("");
  const assignedLabelIds = new Set(organisation?.labels.map((label) => label.id));

  const createLabel = () => {
    const name = labelName.trim();

    if (!name) {
      return;
    }

    onCreateLabel(name);
    setLabelName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Organise conversation</DialogTitle>
          <DialogDescription>
            Pin, track, snooze or label this conversation without changing who can access it.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !organisation ? (
          <p className="text-muted-foreground py-6 text-sm">Loading organisation…</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={organisation.isPinned ? "secondary" : "outline"}
                disabled={isSaving}
                onClick={() => onUpdate({ isPinned: !organisation.isPinned })}
              >
                {organisation.isPinned ? "Unpin" : "Pin"}
              </Button>
              <Button
                type="button"
                variant={organisation.isUnread ? "secondary" : "outline"}
                disabled={isSaving}
                onClick={() => onUpdate({ isUnread: !organisation.isUnread })}
              >
                Mark {organisation.isUnread ? "read" : "unread"}
              </Button>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Snooze</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => onUpdate({ snooze: { kind: "until", until: tomorrowAt } })}
                >
                  Until tomorrow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => onUpdate({ snooze: { kind: "next_response" } })}
                >
                  Until next response
                </Button>
                {organisation.snooze && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isSaving}
                    onClick={() => onUpdate({ snooze: null })}
                  >
                    Clear snooze
                  </Button>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Labels</h3>
              {organisation.availableLabels.length === 0 ? (
                <p className="text-muted-foreground text-sm">No labels yet.</p>
              ) : (
                <ul className="space-y-1">
                  {organisation.availableLabels.map((label) => (
                    <li
                      key={label.id}
                      className="hover:bg-muted flex items-center gap-2 rounded p-2"
                    >
                      <Checkbox
                        checked={assignedLabelIds.has(label.id)}
                        disabled={isSaving}
                        aria-label={`Assign ${label.name}`}
                        onCheckedChange={(checked) => onSetLabel(label.id, checked === true)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{label.name}</span>
                      {canManageLabels && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => onDeleteLabel(label)}
                        >
                          Delete
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canManageLabels && (
                <div className="flex gap-2 pt-1">
                  <Input
                    value={labelName}
                    maxLength={40}
                    placeholder="New label"
                    aria-label="New label name"
                    onChange={(event) => setLabelName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        createLabel();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    disabled={isSaving || !labelName.trim()}
                    onClick={createLabel}
                  >
                    Add
                  </Button>
                </div>
              )}
            </section>
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
