import { Button, FormInput, Textarea } from "@ngriffin_uk/polychat-component-ui";
import type { useMcpConnections } from "@ngriffin_uk/polychat-library-react";
import { useSearchParams } from "react-router";

import { useMcpConnectionForm } from "./useMcpConnectionForm.js";

const CONSENT_COPY = {
  polychat:
    "Allow Polychat to keep this credential encrypted and use it to call only the tools listed above. You approve each operation before it runs, with any model.",
  openai:
    "Allow Polychat to share this token with OpenAI so it can connect to this endpoint. Approve each operation before it runs.",
} as const;

export function McpConnectionManager({
  connections,
}: {
  connections: ReturnType<typeof useMcpConnections>;
}) {
  const form = useMcpConnectionForm(connections);
  const [searchParams] = useSearchParams();
  const signInOutcome = searchParams.get("mcp");

  return (
    <div className="space-y-3 border-t pt-3">
      {signInOutcome === "connected" ? (
        <p role="status" className="text-sm text-muted-foreground">
          Signed in. The connection is ready to use.
        </p>
      ) : signInOutcome === "failed" ? (
        <p role="alert" className="text-sm text-failure">
          Signing in did not finish. Try connecting again.
        </p>
      ) : null}
      {connections.query.error ? (
        <p role="alert" className="text-sm text-failure">
          Saved connections could not be loaded.
        </p>
      ) : null}
      {connections.query.data?.connections.map((connection) => (
        <div className="flex items-center justify-between gap-2 text-sm" key={connection.id}>
          <span className="min-w-0 truncate">
            {connection.label}
            <span className="ml-2 text-xs text-muted-foreground">
              {connection.credentialRecipient === "openai" ? "OpenAI hosted" : "Any model"}
              {connection.authMethod === "oauth" ? " · signed in" : " · token"}
            </span>
          </span>
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
          <fieldset className="space-y-1 text-sm">
            <legend className="font-medium">Use it with</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mcp-recipient"
                checked={form.recipient === "polychat"}
                onChange={() => form.setRecipient("polychat")}
              />
              Any model, through Polychat
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mcp-recipient"
                checked={form.recipient === "openai"}
                onChange={() => {
                  form.setRecipient("openai");
                  form.setAuthChoice("token");
                }}
              />
              OpenAI models, through OpenAI&apos;s hosted MCP tool
            </label>
          </fieldset>
          {form.recipient === "polychat" ? (
            <fieldset className="space-y-1 text-sm">
              <legend className="font-medium">Authenticate with</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mcp-auth"
                  checked={form.authChoice === "sign_in"}
                  onChange={() => form.setAuthChoice("sign_in")}
                />
                Sign in to the server
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mcp-auth"
                  checked={form.authChoice === "token"}
                  onChange={() => form.setAuthChoice("token")}
                />
                A bearer token
              </label>
            </fieldset>
          ) : null}
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
          {form.usesSignIn ? null : (
            <FormInput
              label="Bearer token"
              type="password"
              autoComplete="off"
              value={form.token}
              maxLength={8192}
              onChange={(event) => form.setToken(event.target.value)}
            />
          )}
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
            <span>{CONSENT_COPY[form.recipient]}</span>
          </label>
          {form.error ? (
            <p role="alert" className="text-sm text-failure">
              {form.error}
            </p>
          ) : null}
          <Button
            disabled={!form.consent}
            isLoading={connections.create.isPending || connections.startSignIn.isPending}
            onClick={() => void form.submit()}
          >
            {form.usesSignIn ? "Sign in and connect" : "Save connection"}
          </Button>
        </div>
      </details>
    </div>
  );
}
