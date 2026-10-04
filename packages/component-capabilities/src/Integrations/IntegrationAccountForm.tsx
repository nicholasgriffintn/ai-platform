import { Button, FormInput } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

export function IntegrationAccountForm({
  connected,
  requiresToken,
  isSaving,
  error,
  onConnect,
  onDisconnect,
}: {
  connected: boolean;
  requiresToken: boolean;
  isSaving: boolean;
  error?: string;
  onConnect: (token?: string) => Promise<void>;
  onDisconnect: () => void;
}) {
  const [token, setToken] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onConnect(requiresToken ? token : undefined)
          .finally(() => setToken(""))
          .catch(() => undefined);
      }}
    >
      <h3 className="text-sm font-medium">Your account</h3>
      <p className="text-sm text-muted-foreground">
        {connected ? "Your account is connected." : "Connect your account to use these actions."}{" "}
        Credentials belong to you and are never shared with project members.
      </p>
      {requiresToken && (
        <FormInput
          label={connected ? "Replacement personal token" : "Personal token"}
          type="password"
          autoComplete="off"
          required
          value={token}
          onChange={(event) => setToken(event.target.value)}
          disabled={isSaving}
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-failure">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {connected ? "Reconnect account" : "Connect account"}
        </Button>
        {connected && (
          <Button type="button" variant="outline" disabled={isSaving} onClick={onDisconnect}>
            Disconnect account
          </Button>
        )}
      </div>
    </form>
  );
}
