import { Button, Card, SignInEmptyState } from "@ngriffin_uk/polychat-component-ui";
import { CheckCircle2, Link2 } from "lucide-react";

export interface InvitationAcceptViewProps {
  hasToken: boolean;
  requiresSignIn: boolean;
  sessionExpired?: boolean;
  onSignIn: () => void;
  isAccepting?: boolean;
  errorMessage?: string;
  acceptedWorkspace?: { id: string; name: string } | null;
  onOpenWorkspace: (workspaceId: string) => void;
}

export function InvitationAcceptView({
  hasToken,
  requiresSignIn,
  sessionExpired = false,
  onSignIn,
  isAccepting = false,
  errorMessage,
  acceptedWorkspace,
  onOpenWorkspace,
}: InvitationAcceptViewProps) {
  if (requiresSignIn) {
    return (
      <SignInEmptyState
        title="Sign in to accept your invitation"
        message={
          sessionExpired
            ? "Your session has expired. Sign in with the invited email address to continue."
            : "Sign in with the email address that received this secure invitation."
        }
        className="w-full"
        onSignIn={onSignIn}
      />
    );
  }

  return (
    <Card className="w-full p-8 text-center">
      {acceptedWorkspace ? (
        <CheckCircle2 size={36} className="mx-auto text-success" />
      ) : (
        <Link2 size={34} className="mx-auto text-muted-foreground" />
      )}
      <h2 className="text-2xl font-bold text-foreground">
        {acceptedWorkspace ? `Welcome to ${acceptedWorkspace.name}` : "Workspace invitation"}
      </h2>
      {!hasToken && (
        <p role="alert" className="text-sm text-failure">
          This invitation link is incomplete.
        </p>
      )}
      {isAccepting && <p className="text-sm text-muted-foreground">Checking your invitation…</p>}
      {errorMessage && (
        <p role="alert" className="text-sm text-failure">
          {errorMessage}
        </p>
      )}
      {acceptedWorkspace && (
        <Button onClick={() => onOpenWorkspace(acceptedWorkspace.id)}>Open workspace</Button>
      )}
    </Card>
  );
}
