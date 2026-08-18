import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormSelect,
} from "@ngriffin_uk/polychat-component-ui";
import { type FormEvent, type ReactNode, useState } from "react";

export interface InviteMemberDialogProps {
  canInviteAdmin: boolean;
  open: boolean;
  /** Present once the invitation exists; the form locks and the link is offered instead. */
  inviteUrl?: string | null;
  errorMessage?: string;
  isSubmitting?: boolean;
  /** Host-owned clipboard control, so the render package never touches the clipboard itself. */
  renderCopyControl: (value: string) => ReactNode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { email: string; role: "admin" | "member" }) => Promise<void> | void;
  onReset: () => void;
}

export function InviteMemberDialog({
  canInviteAdmin,
  open,
  inviteUrl,
  errorMessage,
  isSubmitting = false,
  renderCopyControl,
  onOpenChange,
  onSubmit,
  onReset,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onReset();
      setEmail("");
      setRole("member");
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({ email, role });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              The secure link is single-use, tied to this email address, and expires after seven
              days.
            </DialogDescription>
          </DialogHeader>
          <FormInput
            label="Email address"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={Boolean(inviteUrl)}
          />
          <FormSelect
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value as "admin" | "member")}
            disabled={Boolean(inviteUrl)}
            options={[
              { value: "member", label: "Member — work in projects" },
              ...(canInviteAdmin
                ? [{ value: "admin", label: "Admin — manage projects and people" }]
                : []),
            ]}
          />
          {inviteUrl && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="mb-3 text-sm font-medium text-emerald-950 dark:text-emerald-100">
                Invitation ready
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="min-w-0 flex-1 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs dark:bg-zinc-950"
                />
                {renderCopyControl(inviteUrl)}
              </div>
            </div>
          )}
          {errorMessage && <p className="text-sm text-red-700">{errorMessage}</p>}
          <DialogFooter>
            {inviteUrl ? (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            ) : (
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Send invite
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
