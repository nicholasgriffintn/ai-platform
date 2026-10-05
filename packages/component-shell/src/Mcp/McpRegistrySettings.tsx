import {
  McpConnectionForm,
  McpServerForm,
  McpToolPolicy,
} from "@ngriffin_uk/polychat-component-account";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useAuthStatus, useMcpRegistry, useWorkspace } from "@ngriffin_uk/polychat-library-react";

export function McpRegistrySettings({ workspaceId }: { workspaceId?: string }) {
  const { isAuthenticated } = useAuthStatus();
  const workspace = useWorkspace(workspaceId);
  const registry = useMcpRegistry(workspaceId, isAuthenticated);
  const managed =
    !workspaceId || workspace.data?.role === "owner" || workspace.data?.role === "admin";
  const pending =
    registry.create.isPending ||
    registry.update.isPending ||
    registry.remove.isPending ||
    registry.connect.isPending ||
    registry.disconnect.isPending ||
    registry.discover.isPending;
  const error =
    registry.query.error ??
    registry.remove.error ??
    registry.disconnect.error ??
    registry.discover.error;

  if (!isAuthenticated) {
    return <p className="text-sm text-muted-foreground">Sign in to manage connected tools.</p>;
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect tools through your own account. Workspace servers share their catalogue; each member
        connects their own credentials.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-failure">
          {error.message}
        </p>
      ) : null}
      {registry.query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading servers…</p>
      ) : null}
      {registry.query.data?.map((server) => (
        <article key={server.id} className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">{server.label}</h3>
          <p className="text-xs break-all text-muted-foreground">{server.endpoint}</p>
          <p className="text-xs text-muted-foreground">
            {server.enabled ? "Enabled" : "Disabled"} ·{" "}
            {server.connected ? "Your account is connected" : "Connect your account to use tools"}
          </p>
          <details>
            <summary className="cursor-pointer text-sm">
              {server.connected ? "Update your connection" : "Connect"}
            </summary>
            <div className="mt-3">
              <McpConnectionForm
                key={server.connectionRevision ?? "new"}
                server={server}
                projects={workspace.data?.projects ?? []}
                pending={pending}
                onConnect={async (input) => {
                  await registry.connect.mutateAsync({ id: server.id, input });
                }}
              />
            </div>
          </details>
          {server.connected ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => registry.disconnect.mutate(server.id)}
            >
              Disconnect your account
            </Button>
          ) : null}
          {server.managed ? (
            <details>
              <summary className="cursor-pointer text-sm">Manage tool access</summary>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  disabled={pending || !server.connected}
                  onClick={() =>
                    registry.discover.mutate({ id: server.id, revision: server.revision })
                  }
                >
                  Refresh tools
                </Button>
                <McpToolPolicy
                  key={server.revision}
                  server={server}
                  pending={pending}
                  onSave={async (input) => {
                    await registry.update.mutateAsync({ id: server.id, input });
                  }}
                />
              </div>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => registry.remove.mutate({ id: server.id, revision: server.revision })}
              >
                Remove server
              </Button>
            </details>
          ) : null}
        </article>
      ))}
      {managed ? (
        <McpServerForm
          workspaceId={workspaceId}
          pending={pending}
          onCreate={async (input) => {
            await registry.create.mutateAsync(input);
          }}
        />
      ) : null}
    </section>
  );
}
