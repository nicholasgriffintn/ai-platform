import { Button, FormCheckbox, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type {
  NativeMcpCatalogTool,
  NativeMcpServer,
  UpdateNativeMcpServer,
} from "@ngriffin_uk/polychat-schemas";

import { useMcpPolicy } from "./useMcpPolicy.js";

export function McpToolPolicy({
  server,
  pending,
  onSave,
}: {
  server: NativeMcpServer;
  pending: boolean;
  onSave: (input: UpdateNativeMcpServer) => Promise<void>;
}) {
  const form = useMcpPolicy(server, onSave);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.save();
      }}
    >
      <FormCheckbox
        label="Enable this server"
        checked={form.enabled}
        onCheckedChange={form.setEnabled}
        disabled={pending}
      />
      <p className="text-xs text-muted-foreground">
        Classify tools yourself. Server hints do not grant access. Each write requires approval for
        its exact parameters.
      </p>
      {form.tools.map((tool) => (
        <div key={tool.name} className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">{tool.name}</p>
          {tool.description ? (
            <p className="text-xs text-muted-foreground">{tool.description}</p>
          ) : null}
          <FormSelect<NativeMcpCatalogTool["access"]>
            label="Access"
            value={tool.access}
            onValueChange={(access) => form.setAccess(tool.name, access)}
            disabled={pending}
            options={[
              { value: "disabled", label: "Disabled" },
              { value: "read", label: "Read only" },
              { value: "write", label: "Write with approval" },
            ]}
          />
          <details>
            <summary className="cursor-pointer text-xs">Review input schema</summary>
            <pre className="mt-2 max-h-60 overflow-auto text-xs break-all whitespace-pre-wrap">
              {JSON.stringify(tool.inputSchema, null, 2)}
            </pre>
          </details>
        </div>
      ))}
      {form.error ? (
        <p role="alert" className="text-sm text-failure">
          {form.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        Save tool access
      </Button>
    </form>
  );
}
