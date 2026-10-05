import { Button, FormInput, FormSelect, FormTextarea } from "@ngriffin_uk/polychat-component-ui";
import type { OidcConnection } from "@ngriffin_uk/polychat-schemas";

import {
  useIdentityConnectionForm,
  type IdentityConnectionChange,
} from "./useIdentityConnectionForm.js";

export function IdentityConnectionForm({
  connection,
  isSaving,
  callbackUrl,
  signInUrl,
  onSave,
}: {
  connection: OidcConnection | null;
  isSaving: boolean;
  callbackUrl?: string;
  signInUrl?: string;
  onSave: (change: IdentityConnectionChange) => Promise<void>;
}) {
  const form = useIdentityConnectionForm(connection, onSave);

  return (
    <form onSubmit={(event) => void form.submit(event)} className="space-y-5">
      <FormInput
        label="Connection name"
        value={form.label}
        required
        maxLength={80}
        disabled={isSaving}
        onChange={(event) => form.setLabel(event.target.value)}
        placeholder="Company sign-in"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label="Issuer URL"
          value={form.issuer}
          type="url"
          required
          disabled={isSaving || Boolean(connection)}
          onChange={(event) => form.setIssuer(event.target.value)}
          placeholder="https://identity.example.com/"
          description="Use the exact issuer from your identity provider."
        />
        <FormInput
          label="Client ID"
          value={form.clientId}
          required
          disabled={isSaving || Boolean(connection)}
          onChange={(event) => form.setClientId(event.target.value)}
        />
      </div>
      <FormInput
        label={connection ? "Replace client secret" : "Client secret"}
        value={form.clientSecret}
        type="password"
        autoComplete="new-password"
        required={!connection}
        disabled={isSaving}
        maxLength={4096}
        onChange={(event) => form.setClientSecret(event.target.value)}
        description={
          connection
            ? "Leave empty to retain the stored secret."
            : "Create a confidential OIDC client with PKCE support."
        }
      />
      {connection ? (
        <FormInput
          label="Identity connection ID"
          value={connection.id}
          readOnly
          description="Use this ID for company sign-in in Polychat."
        />
      ) : null}
      {callbackUrl ? (
        <FormInput
          label="Callback URL"
          value={callbackUrl}
          readOnly
          description="Register this exact callback with your identity provider."
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Save the connection to obtain its callback URL.
        </p>
      )}
      {signInUrl ? (
        <FormInput
          label="Workspace sign-in link"
          value={signInUrl}
          readOnly
          description="Share this link with people who use your company identity provider."
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect<"RS256" | "ES256">
          label="ID token signing"
          value={form.signingAlgorithm}
          disabled={isSaving}
          options={[
            { value: "RS256", label: "RS256" },
            { value: "ES256", label: "ES256" },
          ]}
          onValueChange={form.setSigningAlgorithm}
        />
      </div>
      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Additional identity provider origins
        </summary>
        <FormTextarea
          className="mt-4"
          label="Allowed HTTPS origins"
          value={form.allowedOrigins}
          disabled={isSaving}
          rows={3}
          description="One origin per line. Add an origin only when discovery uses a separate authorisation, token or key host."
          onChange={(event) => form.setAllowedOrigins(event.target.value)}
        />
      </details>
      <FormSelect<"enabled" | "disabled">
        label="Sign-in availability"
        value={form.enabled ? "enabled" : "disabled"}
        disabled={isSaving}
        options={[
          { value: "enabled", label: "Enabled" },
          { value: "disabled", label: "Disabled" },
        ]}
        onValueChange={(value) => form.setEnabled(value === "enabled")}
      />
      <p className="text-xs text-muted-foreground">
        Workspace membership and roles are managed in People & access.
      </p>
      {form.error ? (
        <p role="alert" className="text-sm text-failure">
          {form.error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" isLoading={isSaving}>
        {connection ? "Save identity settings" : "Connect identity provider"}
      </Button>
    </form>
  );
}
