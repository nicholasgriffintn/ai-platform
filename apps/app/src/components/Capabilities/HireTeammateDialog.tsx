import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  Label,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  listTeammateRolesByCategory,
  TEAMMATE_PERMISSIONS_SENTENCE,
  type HireTeammateInput,
  type TeammateRole,
} from "@ngriffin_uk/polychat-schemas";
import { Bot, UserRound } from "lucide-react";
import { useState } from "react";

interface HireTeammateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHire: (input: HireTeammateInput) => Promise<unknown>;
  isHiring: boolean;
  error?: Error | null;
  workspaceId?: string;
}

const roleGroups = listTeammateRolesByCategory();

export function HireTeammateDialog({
  open,
  onOpenChange,
  onHire,
  isHiring,
  error,
  workspaceId,
}: HireTeammateDialogProps) {
  const [selectedRole, setSelectedRole] = useState<TeammateRole | null>(null);
  const [name, setName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const canHire = Boolean(selectedRole) || jobDescription.trim().length > 0;

  const reset = () => {
    setSelectedRole(null);
    setName("");
    setJobDescription("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset();
    }

    onOpenChange(next);
  };

  const hire = async () => {
    if (!canHire) {
      return;
    }

    await onHire({
      ...(selectedRole ? { role_slug: selectedRole.slug } : {}),
      ...(jobDescription.trim() ? { job_description: jobDescription.trim() } : {}),
      ...(name.trim() ? { name: name.trim() } : {}),
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Hire a teammate</DialogTitle>
          <DialogDescription>
            Pick a role to start from, describe the job in your own words, or do both. You can
            change anything afterwards.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="text-sm text-failure">
            {error.message}
          </p>
        )}

        <div className="max-h-[22rem] space-y-5 overflow-y-auto pr-1">
          {roleGroups.map((group) => (
            <section key={group.category} className="space-y-2">
              <h3 className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                {group.category}
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {group.roles.map((role) => {
                  const isSelected = selectedRole?.slug === role.slug;

                  return (
                    <li key={role.slug}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedRole(isSelected ? null : role)}
                        className={cn(
                          "border-border hover:bg-selection flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                          isSelected && "border-active-work bg-selection",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {role.kind === "bot" ? (
                            <Bot size={15} className="text-muted-foreground shrink-0" />
                          ) : (
                            <UserRound size={15} className="text-muted-foreground shrink-0" />
                          )}
                          <span className="min-w-0 truncate text-sm font-medium">{role.title}</span>
                        </span>
                        <span className="text-muted-foreground text-xs">{role.summary}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="space-y-3">
          <FormInput
            label="Name"
            value={name}
            placeholder={selectedRole?.title ?? "Name this teammate"}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="space-y-1">
            <Label htmlFor="hire-teammate-brief">
              {selectedRole ? "Anything else it should know" : "Describe the job"}
            </Label>
            <Textarea
              id="hire-teammate-brief"
              rows={3}
              value={jobDescription}
              placeholder="What it should do, what it should never do, and how you want the answer."
              onChange={(event) => setJobDescription(event.target.value)}
            />
          </div>
          <p className="text-muted-foreground text-xs">{TEAMMATE_PERMISSIONS_SENTENCE}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canHire}
            isLoading={isHiring}
            onClick={() => void hire()}
          >
            Hire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
