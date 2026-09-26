import { ProviderCatalogueList } from "@ngriffin_uk/polychat-component-models";
import {
  Badge,
  Button,
  CardSkeleton,
  FormDialog,
  FormInput,
  FormSection,
  FormSelect,
  FormTextarea,
} from "@ngriffin_uk/polychat-component-ui";
import { useModelPlatformMutations, useModelProviders } from "@ngriffin_uk/polychat-library-react";
import type {
  ConnectionCheck,
  ConnectionField,
  ModelConnection,
  ProviderCatalogueEntry,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";

function fieldLabel(field: ConnectionField): string {
  return field.required ? field.label : `${field.label} (optional)`;
}

function FieldInput({
  field,
  value,
  saved,
  onChange,
}: {
  field: ConnectionField;
  value: string;
  saved: boolean;
  onChange: (value: string) => void;
}) {
  const placeholder = saved ? "Saved. Leave blank to keep it." : field.placeholder;

  if (field.kind === "select") {
    return (
      <FormSelect
        label={fieldLabel(field)}
        description={field.help}
        value={value}
        onValueChange={onChange}
        placeholder={field.placeholder ?? "Choose one"}
        options={field.options ?? []}
      />
    );
  }

  if (field.kind === "secret" && field.key.toLowerCase().includes("json")) {
    return (
      <FormTextarea
        label={fieldLabel(field)}
        description={field.help}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 font-mono text-xs"
      />
    );
  }

  return (
    <FormInput
      label={fieldLabel(field)}
      description={field.help}
      type={field.kind === "secret" ? "password" : "text"}
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function CheckResult({ check }: { check: ConnectionCheck }) {
  const allowed = Object.entries(check.capabilities).filter(([, can]) => can);

  return (
    <div className="space-y-2 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <ShieldCheck size={16} className="text-success" />
        Signed in as {check.account}
      </div>
      <div className="flex flex-wrap gap-1">
        {allowed.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            These credentials cannot do anything useful yet.
          </span>
        ) : (
          allowed.map(([capability]) => (
            <Badge key={capability} variant="secondary">
              Can {capability}
            </Badge>
          ))
        )}
      </div>
      {check.namespaces.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Namespaces:{" "}
          {check.namespaces
            .map((namespace) => `${namespace.name}${namespace.canWrite ? "" : " (read only)"}`)
            .join(", ")}
        </p>
      )}
      {check.message && <p className="text-xs text-muted-foreground">{check.message}</p>}
    </div>
  );
}

function connectionRequest(fields: readonly ConnectionField[], values: Record<string, string>) {
  const secrets: Record<string, string> = {};
  const config: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.key]?.trim();

    if (value) {
      (field.kind === "secret" ? secrets : config)[field.key] = value;
    }
  }

  return { secrets, config };
}

function isMissing(
  field: ConnectionField,
  values: Record<string, string>,
  connection: ModelConnection | null,
) {
  return (
    field.required &&
    !values[field.key]?.trim() &&
    !(field.kind === "secret" && connection?.secretKeys.includes(field.key))
  );
}

function ConnectProviderDialog({
  entry,
  onClose,
}: {
  entry: ProviderCatalogueEntry;
  onClose: () => void;
}) {
  const { workspaceId } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const { manifest, connection } = entry;
  const [values, setValues] = useState<Record<string, string>>(connection?.config ?? {});
  const [check, setCheck] = useState<ConnectionCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const fields = manifest.connection.fields;
  const secrets = fields.filter((field) => field.kind === "secret");
  const settings = fields.filter((field) => field.kind !== "secret");
  const missing = fields.some((field) => isMissing(field, values, connection));
  const update = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setCheck(null);
    setCheckError(null);
  };

  const renderField = (field: ConnectionField) => (
    <FieldInput
      key={field.key}
      field={field}
      value={values[field.key] ?? ""}
      saved={field.kind === "secret" && Boolean(connection?.secretKeys.includes(field.key))}
      onChange={(value) => update(field.key, value)}
    />
  );

  const runCheck = async () => {
    setCheckError(null);

    try {
      setCheck(
        await mutations.checkProvider.mutateAsync({
          provider: manifest.id,
          input: connectionRequest(fields, values),
        }),
      );
    } catch (error) {
      setCheck(null);
      setCheckError(getErrorMessage(error, "The provider refused those credentials"));
    }
  };

  const submit = async () => {
    const saved = await runWithToast(`${manifest.name} connected`, () =>
      mutations.saveProvider.mutateAsync({
        provider: manifest.id,
        input: connectionRequest(fields, values),
      }),
    );

    if (saved) {
      onClose();
    }
  };

  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      title={connection ? `Update ${manifest.name}` : `Connect ${manifest.name}`}
      description="Credentials are sealed at rest and never shown again. Use a key scoped to only what you want Polychat to do."
      onSubmit={submit}
      submitText="Save connection"
      isLoading={mutations.saveProvider.isPending}
      submitDisabled={missing}
    >
      <div className="space-y-5">
        {secrets.length > 0 && (
          <FormSection title="Credentials">
            <div className="space-y-3">{secrets.map(renderField)}</div>
          </FormSection>
        )}
        {settings.length > 0 && (
          <FormSection title="Where work runs">
            <div className="space-y-3">{settings.map(renderField)}</div>
          </FormSection>
        )}
        <FormSection
          title="Check the connection"
          description="See what these credentials can read, store, train and host before you save them."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              size="sm"
              variant="outline"
              icon={<ShieldCheck size={14} />}
              disabled={missing}
              isLoading={mutations.checkProvider.isPending}
              onClick={() => void runCheck()}
            >
              Check connection
            </Button>
            <a
              href={manifest.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {manifest.vendor} setup guide
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
          {check && <CheckResult check={check} />}
          {checkError && (
            <p className="rounded-md border border-failure/40 bg-failure/5 p-3 text-sm text-failure">
              {checkError}
            </p>
          )}
        </FormSection>
      </div>
    </FormDialog>
  );
}

export function ProvidersSection() {
  const { workspaceId, can } = useModelsScope();
  const providers = useModelProviders(workspaceId);
  const mutations = useModelPlatformMutations(workspaceId);
  const [editing, setEditing] = useState<ProviderCatalogueEntry | null>(null);

  return (
    <ModelsSection
      title="Provider accounts"
      description="Bring your own accounts. Training and serving run there and bill you directly; we orchestrate and keep the evidence."
    >
      {providers.data ? (
        <ProviderCatalogueList
          providers={providers.data.providers}
          canManage={can("manage_connections")}
          onConnect={setEditing}
          onDisconnect={(entry) =>
            void runWithToast(`${entry.manifest.name} disconnected`, () =>
              mutations.deleteProvider.mutateAsync(entry.manifest.id),
            )
          }
        />
      ) : (
        <CardSkeleton />
      )}
      {editing && (
        <ConnectProviderDialog
          key={editing.manifest.id}
          entry={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </ModelsSection>
  );
}
