import { Button, FormCheckbox } from "@ngriffin_uk/polychat-component-ui";
import { formatConnectorLabel } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

interface GrantableOperation {
  id: string;
  access: "read" | "write";
  destructive: boolean;
}

export function OperationGrantForm({
  operations,
  initialOperations,
  canManage,
  isSaving,
  error,
  onSave,
  onRevoke,
}: {
  operations: readonly GrantableOperation[];
  initialOperations: readonly string[];
  canManage: boolean;
  isSaving: boolean;
  error?: string;
  onSave: (operations: string[]) => void;
  onRevoke?: () => void;
}) {
  const [selected, setSelected] = useState(
    () =>
      new Set(
        initialOperations.filter((id) => operations.some((operation) => operation.id === id)),
      ),
  );
  const unavailable = initialOperations.filter(
    (id) => !operations.some((operation) => operation.id === id),
  );

  return (
    <fieldset className="space-y-3" disabled={isSaving}>
      <legend className="text-sm font-medium">Project access</legend>
      <p className="text-xs text-muted-foreground">
        Choose the actions this project may use. Each person connects their own account. Actions
        that change data still require approval.
      </p>
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
        {operations.map((operation) => (
          <FormCheckbox
            key={operation.id}
            label={formatConnectorLabel(operation.id)}
            description={
              operation.destructive
                ? "Destructive action · approval required"
                : operation.access === "write"
                  ? "Changes data · approval required"
                  : "Reads data"
            }
            checked={selected.has(operation.id)}
            disabled={!canManage}
            onCheckedChange={(checked) =>
              setSelected((current) => {
                const next = new Set(current);

                if (checked) {
                  next.add(operation.id);
                } else {
                  next.delete(operation.id);
                }

                return next;
              })
            }
          />
        ))}
      </div>
      {unavailable.length > 0 && (
        <output className="block text-sm text-muted-foreground">
          These previously granted actions are unavailable for this connector and will be removed
          when you save: {unavailable.map(formatConnectorLabel).join(", ")}.
        </output>
      )}
      {error && (
        <p role="alert" className="text-sm text-failure">
          {error}
        </p>
      )}
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={selected.size === 0}
            onClick={() => onSave([...selected])}
          >
            {isSaving ? "Saving…" : "Save project access"}
          </Button>
          {onRevoke && (
            <Button type="button" variant="destructive" onClick={onRevoke}>
              Remove project access
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Ask a project admin to change access.</p>
      )}
    </fieldset>
  );
}
