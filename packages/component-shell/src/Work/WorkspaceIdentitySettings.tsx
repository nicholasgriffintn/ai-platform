import { Button, Card, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import { IdentityConnectionForm } from "@ngriffin_uk/polychat-component-workspaces";
import { enterpriseIdentityUrls } from "@ngriffin_uk/polychat-library-client";
import { useWorkspaceIdentity } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

export function WorkspaceIdentitySettings({ workspaceId }: { workspaceId: string }) {
  const { query, create, update, remove } = useWorkspaceIdentity(workspaceId, true);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const connection = query.data?.connection ?? null;
  const urls = connection ? enterpriseIdentityUrls(connection.id) : undefined;

  return (
    <section className="mt-10 space-y-3">
      <h2 className="text-sm font-semibold">Enterprise sign-in</h2>
      <p className="text-sm text-muted-foreground">
        Use your identity provider to grant workspace access by group. Managed access lasts up to 15
        minutes between verified sign-ins; Work still requires each person's Pro entitlement.
      </p>
      <Card className="p-5 shadow-none">
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading identity settings…</p>
        ) : query.error ? (
          <div role="alert" className="space-y-3 text-sm text-failure">
            <p>{query.error.message}</p>
            <Button onClick={() => void query.refetch()}>Retry</Button>
          </div>
        ) : (
          <IdentityConnectionForm
            key={connection ? `${connection.id}:${connection.revision}` : "new"}
            connection={connection}
            isSaving={create.isPending || update.isPending || remove.isPending}
            callbackUrl={urls?.callback}
            signInUrl={urls?.signIn}
            onSave={async (change) => {
              if (change.kind === "create") {
                await create.mutateAsync(change.input);
              } else {
                await update.mutateAsync(change.input);
              }
            }}
          />
        )}
        {connection ? (
          <Button className="mt-5" variant="destructive" onClick={() => setConfirmRemove(true)}>
            Disconnect identity provider
          </Button>
        ) : null}
        {remove.error ? (
          <p role="alert" className="mt-3 text-sm text-failure">
            {remove.error.message}
          </p>
        ) : null}
      </Card>
      <ConfirmationDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Disconnect identity provider"
        description="This revokes every membership managed by this identity provider. Manual memberships remain available. Reconnecting creates a new identity connection."
        confirmText="Disconnect"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync();
          setConfirmRemove(false);
        }}
      />
    </section>
  );
}
