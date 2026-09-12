import { Button, ButtonLink, Checkbox } from "@ngriffin_uk/polychat-component-ui";
import { getErrorMessage, useTeammateConnectionGrants } from "@ngriffin_uk/polychat-library-react";
import type {
  TeammateConnectionGrant,
  TeammateConnectionGrantListResponse,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

type Connection = TeammateConnectionGrantListResponse["connections"][number];

function ConnectionGrantEditor({
  connection,
  grant,
  disabled,
  onSave,
}: {
  connection: Connection;
  grant?: TeammateConnectionGrant;
  disabled: boolean;
  onSave: (operations: string[]) => void;
}) {
  const [selected, setSelected] = useState(() => new Set(grant?.allowedOperations ?? []));
  const accountLabel = connection.accountId
    ? `Account …${connection.accountId.slice(-6)}`
    : "Connected account";

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{connection.providerName}</p>
          <p className="text-xs text-muted-foreground">{accountLabel}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onSave([...selected].sort())}
        >
          Save access
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {connection.allowedOperations.map((operation) => (
          <label key={operation} className="flex cursor-pointer items-start gap-2 text-xs">
            <Checkbox
              checked={selected.has(operation)}
              disabled={disabled}
              onCheckedChange={(checked) => {
                setSelected((current) => {
                  const next = new Set(current);

                  if (checked === true) {
                    next.add(operation);
                  } else {
                    next.delete(operation);
                  }

                  return next;
                });
              }}
            />
            <span className="break-all text-muted-foreground">{operation}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function TeammateConnectionGrantsPanel({ contextId }: { contextId: string }) {
  const { connections, grants, isLoading, error, update } = useTeammateConnectionGrants(contextId);

  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <p className="text-sm font-medium text-foreground">Connections</p>
        <p className="text-xs text-muted-foreground">
          Grant exact operations on one account per provider. Changes apply to the next operation.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {getErrorMessage(error, "Could not load connection access.")}
        </p>
      )}

      {!isLoading && connections.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            Connect an account before granting access.
          </p>
          <ButtonLink href="/profile?tab=providers&type=connector" size="sm" variant="outline">
            Manage connections
          </ButtonLink>
        </div>
      )}

      {connections.map((connection) => {
        const grant = grants.find((candidate) => candidate.connectionId === connection.id);

        return (
          <ConnectionGrantEditor
            key={`${connection.id}:${grant?.revision ?? 0}`}
            connection={connection}
            grant={grant}
            disabled={update.isPending}
            onSave={(allowedOperations) =>
              update.mutate({
                connectionId: connection.id,
                allowedOperations,
                ...(grant ? { expectedRevision: grant.revision } : {}),
              })
            }
          />
        );
      })}

      {update.error && (
        <p className="text-sm text-destructive">
          {getErrorMessage(update.error, "Could not save connection access.")}
        </p>
      )}
    </div>
  );
}
