import { Button, FormCheckbox, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type {
  ConnectNativeMcpServer,
  NativeMcpCredential,
  NativeMcpServer,
} from "@ngriffin_uk/polychat-schemas";

import { useMcpConnectionForm } from "./useMcpForms.js";

export function McpConnectionForm({
  server,
  projects,
  pending,
  onConnect,
}: {
  server: NativeMcpServer;
  projects: { id: string; name: string }[];
  pending: boolean;
  onConnect: (input: ConnectNativeMcpServer) => Promise<void>;
}) {
  const form = useMcpConnectionForm(server.sharedProjectIds, onConnect);

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit();
      }}
    >
      <p className="text-sm font-medium">
        {server.connected ? "Replace your connection" : "Connect your account"}
      </p>
      <FormSelect<NativeMcpCredential["type"]>
        label="Authentication"
        value={form.type}
        onValueChange={form.setType}
        disabled={pending}
        options={[
          { value: "none", label: "No credentials" },
          { value: "bearer", label: "Bearer token" },
          { value: "api-key", label: "API key (X-API-Key)" },
        ]}
      />
      {form.type !== "none" ? (
        <FormInput
          label={form.type === "bearer" ? "Bearer token" : "API key"}
          type="password"
          autoComplete="new-password"
          value={form.value}
          onChange={(event) => form.setValue(event.target.value)}
          disabled={pending}
        />
      ) : null}
      <FormCheckbox
        label="Allow requests to this server"
        description={`Polychat may send your credential and selected tool parameters to ${server.endpoint}. Your credential is stored encrypted and is never shared with other members.`}
        checked={form.endpointConsent}
        onCheckedChange={form.setEndpointConsent}
        disabled={pending}
      />
      {projects.length ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Allow results in these projects</legend>
          <p className="text-xs text-muted-foreground">
            Tool results become visible to all members of each selected project.
          </p>
          {projects.map((project) => (
            <FormCheckbox
              key={project.id}
              label={project.name}
              checked={form.sharedProjectIds.includes(project.id)}
              disabled={pending}
              onCheckedChange={(checked) =>
                form.setSharedProjectIds(
                  checked
                    ? [...form.sharedProjectIds, project.id]
                    : form.sharedProjectIds.filter((id) => id !== project.id),
                )
              }
            />
          ))}
        </fieldset>
      ) : null}
      {form.error ? (
        <p role="alert" className="text-sm text-failure">
          {form.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !form.endpointConsent}>
        Save connection
      </Button>
    </form>
  );
}
