import { Button, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { createIntegrationSchema, type CreateIntegration } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function CreateIntegrationForm({
  isSaving,
  error,
  onCreate,
}: {
  isSaving: boolean;
  error?: string;
  onCreate: (input: Omit<CreateIntegration, "workspaceId">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [description, setDescription] = useState("");
  const [authentication, setAuthentication] = useState<"none" | "bearer">("bearer");
  const [token, setToken] = useState("");
  const [validationError, setValidationError] = useState<string>();

  const submit = async () => {
    const input = createIntegrationSchema.safeParse({
      name,
      endpoint,
      description,
      authentication,
      token: authentication === "bearer" ? token : undefined,
    });

    if (!input.success) {
      setValidationError(input.error.issues[0]?.message);

      return;
    }

    setValidationError(undefined);
    try {
      await onCreate(input.data);
      setName("");
      setEndpoint("");
      setDescription("");
    } finally {
      setToken("");
    }
  };

  return (
    <form
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit().catch(() => undefined);
      }}
    >
      <h3 className="font-medium">Add a custom integration</h3>
      <p className="text-sm text-muted-foreground">
        Connect a service that provides an MCP endpoint. Polychat discovers its actions and keeps
        your credentials private.
      </p>
      <FormInput
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={isSaving}
        required
        maxLength={100}
      />
      <FormInput
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        disabled={isSaving}
        maxLength={1000}
      />
      <FormInput
        label="Service endpoint"
        type="url"
        placeholder="https://service.example.com/mcp"
        value={endpoint}
        onChange={(event) => setEndpoint(event.target.value)}
        disabled={isSaving}
        required
      />
      <FormSelect<"none" | "bearer">
        label="Authentication"
        value={authentication}
        onValueChange={setAuthentication}
        disabled={isSaving}
        options={[
          { value: "bearer", label: "Personal access token" },
          { value: "none", label: "No credentials" },
        ]}
      />
      {authentication === "bearer" && (
        <FormInput
          label="Your personal access token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          disabled={isSaving}
          required
        />
      )}
      <p className="text-xs text-muted-foreground">
        The endpoint is fixed when you add the integration. Add a new definition if the service
        moves. Review changes to its actions before upgrading project access.
      </p>
      {(error || validationError) && (
        <p role="alert" className="text-sm text-failure">
          {error ?? validationError}
        </p>
      )}
      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Checking service…" : "Add integration"}
      </Button>
    </form>
  );
}
