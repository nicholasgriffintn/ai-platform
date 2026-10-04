import { Button, FormInput, Textarea } from "@ngriffin_uk/polychat-component-ui";
import type { useMcpConnections } from "@ngriffin_uk/polychat-library-react";

import { useMcpConnectionForm } from "./useMcpConnectionForm.js";

export function McpConnectionManager({
  connections,
}: {
  connections: ReturnType<typeof useMcpConnections>;
}) {
  const form = useMcpConnectionForm(connections);

  return (
    <div className="space-y-3 border-t pt-3">
      {connections.query.error ? (
        <p role="alert" className="text-sm text-failure">
          Saved connections could not be loaded.
        </p>
      ) : null}
      {connections.query.data?.connections.map((connection) => (
        <div className="flex items-center justify-between gap-2 text-sm" key={connection.id}>
          <span>{connection.label}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={connections.remove.isPending}
            onClick={() => connections.remove.mutate(connection.id)}
          >
            Disconnect
          </Button>
        </div>
      ))}
      {connections.remove.error ? (
        <p role="alert" className="text-sm text-failure">
          The connection could not be removed.
        </p>
      ) : null}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Save an authenticated connection
        </summary>
        <div className="mt-3 space-y-3">
          <FormInput
            label="Connection name"
            value={form.label}
            maxLength={80}
            onChange={(event) => form.setLabel(event.target.value)}
          />
          <FormInput
            label="MCP endpoint"
            type="url"
            value={form.url}
            maxLength={2048}
            onChange={(event) => form.setUrl(event.target.value)}
          />
          <FormInput
            label="Bearer token"
            type="password"
            autoComplete="off"
            value={form.token}
            maxLength={8192}
            onChange={(event) => form.setToken(event.target.value)}
          />
          <label htmlFor="mcp-connection-tools" className="block text-sm">
            Allowed tool names, one per line
            <Textarea
              id="mcp-connection-tools"
              value={form.tools}
              rows={3}
              onChange={(event) => form.setTools(event.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(event) => form.setConsent(event.target.checked)}
            />
            <span>
              Allow Polychat to share this token with OpenAI so it can connect to this endpoint.
              Approve each operation before it runs.
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            Private services need a reachable HTTPS gateway. This connection does not create network
            access.
          </p>
          {form.error ? (
            <p role="alert" className="text-sm text-failure">
              {form.error}
            </p>
          ) : null}
          <Button
            disabled={!form.consent}
            isLoading={connections.create.isPending}
            onClick={() => void form.submit()}
          >
            Save connection
          </Button>
        </div>
      </details>
    </div>
  );
}
