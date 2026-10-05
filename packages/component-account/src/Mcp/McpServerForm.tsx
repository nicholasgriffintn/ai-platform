import { Button, FormInput } from "@ngriffin_uk/polychat-component-ui";
import type { CreateNativeMcpServer } from "@ngriffin_uk/polychat-schemas";

import { useMcpServerForm } from "./useMcpForms.js";

export function McpServerForm({
  workspaceId,
  pending,
  onCreate,
}: {
  workspaceId?: string;
  pending: boolean;
  onCreate: (input: CreateNativeMcpServer) => Promise<void>;
}) {
  const form = useMcpServerForm(workspaceId, onCreate);

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit();
      }}
    >
      <p className="text-sm font-medium">Add an MCP server</p>
      <FormInput
        label="Name"
        value={form.label}
        disabled={pending}
        onChange={(event) => form.setLabel(event.target.value)}
      />
      <FormInput
        label="HTTPS endpoint"
        type="url"
        value={form.endpoint}
        disabled={pending}
        onChange={(event) => form.setEndpoint(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        New tools start disabled. Review their schemas before allowing access.
      </p>
      {form.error ? (
        <p role="alert" className="text-sm text-failure">
          {form.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        Add server
      </Button>
    </form>
  );
}
