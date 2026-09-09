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
  Input,
} from "@ngriffin_uk/polychat-component-ui";
import { type FormEvent, type ReactNode, useState } from "react";

export interface InviteMemberDialogProps {
  canInviteAdmin: boolean;
  open: boolean;
  inviteUrl?: string | null;
  errorMessage?: string;
  isSubmitting?: boolean;
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
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-5"
        >
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
          <FormSelect<"admin" | "member">
            label="Role"
            value={role}
            onValueChange={setRole}
            disabled={Boolean(inviteUrl)}
            options={
              canInviteAdmin
                ? [
                    { value: "member", label: "Member — work in projects" },
                    { value: "admin", label: "Admin — manage projects and people" },
                  ]
                : [{ value: "member", label: "Member — work in projects" }]
            }
          />
          {inviteUrl && (
            <div className="rounded-xl border border-success/45 bg-success/12 p-4">
              <p className="mb-3 text-sm font-medium text-success">Invitation ready</p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={inviteUrl}
                  aria-label="Invitation link"
                  className="min-w-0 flex-1 border-success/45 bg-surface text-xs"
                />
                {renderCopyControl(inviteUrl)}
              </div>
            </div>
          )}
          {errorMessage && (
            <p role="alert" className="text-sm text-failure">
              {errorMessage}
            </p>
          )}
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
