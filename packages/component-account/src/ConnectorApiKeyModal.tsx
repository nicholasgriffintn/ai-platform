import { FormDialog, Input, Label } from "@ngriffin_uk/polychat-component-ui";
import type { RecipeConnectorManifest } from "@ngriffin_uk/polychat-schemas";
import { useState, type ReactNode } from "react";

type CredentialFields = NonNullable<RecipeConnectorManifest["credentialFields"]>;

const DEFAULT_CREDENTIAL_FIELDS: CredentialFields = [{ label: "API key", secret: true }];

export interface ConnectorApiKeyModalProps {
  open: boolean;
  providerName: string;
  credentialFields?: CredentialFields;
  callbackUrl?: string;
  renderCopyButton?: (value: string) => ReactNode;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (credentials: string[]) => Promise<void> | void;
}

export function ConnectorApiKeyModal({
  open,
  providerName,
  credentialFields,
  callbackUrl,
  renderCopyButton,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: ConnectorApiKeyModalProps) {
  const [values, setValues] = useState<string[]>([]);
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);

    if (!open) {
      setValues([]);
    }
  }

  const fields = credentialFields?.length ? credentialFields : DEFAULT_CREDENTIAL_FIELDS;
  const credentials = fields.map((_, index) => values[index]?.trim() ?? "");
  const complete = credentials.every(Boolean);
  const fieldNames = fields.map((field) => field.label.toLowerCase()).join(" and ");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Connect ${providerName}`}
      description={`Store your ${fieldNames} for recipe connectors.`}
      onSubmit={() => onSubmit(credentials)}
      submitText="Connect"
      isLoading={isSubmitting}
      submitDisabled={!complete || isSubmitting}
    >
      {fields.map((field, index) => (
        <div key={field.label} className="space-y-2">
          <Label htmlFor={`connector-credential-${index}`}>{field.label}</Label>
          <Input
            id={`connector-credential-${index}`}
            type={field.secret ? "password" : "text"}
            value={values[index] ?? ""}
            onChange={(event) => {
              const next = [...values];

              next[index] = event.target.value;
              setValues(next);
            }}
            placeholder={`Paste ${field.label.toLowerCase()}`}
            autoComplete="off"
          />
        </div>
      ))}
      {callbackUrl ? (
        <div className="space-y-2">
          <Label htmlFor="connector-callback-url">Callback URL</Label>
          <div className="flex items-center gap-2">
            <Input
              id="connector-callback-url"
              value={callbackUrl}
              readOnly
              onFocus={(event) => event.target.select()}
              className="font-mono text-xs"
            />
            {renderCopyButton?.(callbackUrl)}
          </div>
          <p className="text-xs text-muted-foreground">
            If {providerName} asks for a callback or redirect URL when you create the key, use this
            one.
          </p>
        </div>
      ) : null}
    </FormDialog>
  );
}
