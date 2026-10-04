import { Button, FormCheckbox, SearchInput } from "@ngriffin_uk/polychat-component-ui";
import { formatConnectorLabel } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export interface GrantableOperation {
  id: string;
  description?: string;
  access?: "read" | "write";
  destructive?: boolean;
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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(
    () =>
      new Set(
        initialOperations.filter((id) => operations.some((operation) => operation.id === id)),
      ),
  );
  const unavailable = initialOperations.filter(
    (id) => !operations.some((operation) => operation.id === id),
  );
  const search = query.trim().toLowerCase();
  const visible = operations.filter((operation) =>
    `${operation.id} ${operation.description ?? ""}`.toLowerCase().includes(search),
  );

  return (
    <fieldset className="space-y-3" disabled={isSaving}>
      <legend className="text-sm font-medium">Project access</legend>
      <p className="text-xs text-muted-foreground">
        Choose the actions this project may use. Each person connects their own account. Actions
        that change data still require approval.
      </p>
      <SearchInput
        aria-label="Search integration actions"
        value={query}
        onChange={setQuery}
        placeholder="Search actions"
      />
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
        {visible.slice(0, 100).map((operation) => (
          <FormCheckbox
            key={operation.id}
            label={formatConnectorLabel(operation.id)}
            description={
              operation.description ??
              (operation.destructive
                ? "Destructive action · approval required"
                : operation.access === "write"
                  ? "Changes data · approval required"
                  : "Reads data")
            }
            checked={selected.has(operation.id)}
            disabled={!canManage || (!selected.has(operation.id) && selected.size >= 500)}
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
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">No matching actions.</p>
        )}
        {visible.length > 100 && (
          <p className="text-xs text-muted-foreground">Refine your search to see more actions.</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{selected.size} actions selected</p>
      {unavailable.length > 0 && (
        <output className="block text-sm text-muted-foreground">
          These previously granted actions are unavailable in this definition and will be removed
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
