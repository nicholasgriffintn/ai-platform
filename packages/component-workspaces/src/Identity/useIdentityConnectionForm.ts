import {
  createOidcConnectionSchema,
  updateOidcConnectionSchema,
  type CreateOidcConnection,
  type UpdateOidcConnection,
  type OidcConnection,
} from "@ngriffin_uk/polychat-schemas";
import { splitNonEmptyLines } from "@ngriffin_uk/polychat-utility-core";
import { useState, type FormEvent } from "react";

export type IdentityConnectionChange =
  | { kind: "create"; input: CreateOidcConnection }
  | { kind: "update"; input: UpdateOidcConnection };
export function useIdentityConnectionForm(
  connection: OidcConnection | null,
  onSave: (change: IdentityConnectionChange) => Promise<void>,
) {
  const [label, setLabel] = useState(connection?.label ?? "");
  const [issuer, setIssuer] = useState(connection?.issuer ?? "");
  const [clientId, setClientId] = useState(connection?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState(connection?.allowedOrigins.join("\n") ?? "");
  const [signingAlgorithm, setSigningAlgorithm] = useState<"RS256" | "ES256">(
    connection?.signingAlgorithm ?? "RS256",
  );
  const [enabled, setEnabled] = useState(connection?.enabled ?? true);
  const [error, setError] = useState<string>();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const fields = {
      label,
      signingAlgorithm,
      enabled,
      allowedOrigins: splitNonEmptyLines(allowedOrigins),
    };
    const change = connection
      ? updateOidcConnectionSchema.safeParse({
          ...fields,
          expectedRevision: connection.revision,
          ...(clientSecret ? { clientSecret } : {}),
        })
      : createOidcConnectionSchema.safeParse({ ...fields, issuer, clientId, clientSecret });

    if (!change.success) {
      setError(change.error.issues[0]?.message ?? "Check the identity settings");

      return;
    }

    setError(undefined);
    try {
      if (connection) {
        await onSave({ kind: "update", input: updateOidcConnectionSchema.parse(change.data) });
      } else {
        await onSave({ kind: "create", input: createOidcConnectionSchema.parse(change.data) });
      }

      setClientSecret("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Identity settings could not be saved");
    }
  };

  return {
    label,
    setLabel,
    issuer,
    setIssuer,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    allowedOrigins,
    setAllowedOrigins,
    signingAlgorithm,
    setSigningAlgorithm,
    enabled,
    setEnabled,
    error,
    submit,
  };
}
