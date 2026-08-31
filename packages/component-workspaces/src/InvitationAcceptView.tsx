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

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-full max-w-xl items-center px-6 py-16">{children}</div>;
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
      <Shell>
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
      </Shell>
    );
  }

  return (
    <Shell>
      <Card className="w-full p-8 text-center">
        {acceptedWorkspace ? (
          <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
        ) : (
          <Link2 size={34} className="mx-auto text-zinc-500" />
        )}
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {acceptedWorkspace ? `Welcome to ${acceptedWorkspace.name}` : "Workspace invitation"}
        </h1>
        {!hasToken && (
          <p role="alert" className="text-sm text-red-700">
            This invitation link is incomplete.
          </p>
        )}
        {isAccepting && <p className="text-sm text-zinc-500">Checking your invitation…</p>}
        {errorMessage && (
          <p role="alert" className="text-sm text-red-700">
            {errorMessage}
          </p>
        )}
        {acceptedWorkspace && (
          <Button onClick={() => onOpenWorkspace(acceptedWorkspace.id)}>Open workspace</Button>
        )}
      </Card>
    </Shell>
  );
}
