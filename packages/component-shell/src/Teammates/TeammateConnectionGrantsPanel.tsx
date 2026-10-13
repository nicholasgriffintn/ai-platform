import {
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  SearchInput,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import { useTeammateConnectionGrants } from "@ngriffin_uk/polychat-library-react";
import type {
  TeammateConnectionGrant,
  TeammateConnectionGrantListResponse,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useMemo, useState } from "react";

import {
  buildOperationViews,
  filterOperations,
  groupOperationsByAccess,
  haveSameMembers,
  pageOperationGroups,
  summariseSelection,
  type ConnectionOperationView,
  type OperationAccessFilter,
} from "./connectionGrantOperations.js";

type Connection = TeammateConnectionGrantListResponse["connections"][number];

const PAGE_SIZE = 60;

const ACCESS_FILTERS: Array<{ value: OperationAccessFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "read", label: "Read" },
  { value: "write", label: "Write" },
  { value: "selected", label: "Selected" },
];

function OperationRow({
  controlId,
  operation,
  checked,
  disabled,
  onCheckedChange,
}: {
  controlId: string;
  operation: ConnectionOperationView;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={controlId}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-selection",
        checked && "bg-selection/60",
      )}
    >
      <Checkbox
        id={controlId}
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-foreground">{operation.label}</span>
          {operation.destructive && (
            <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
              Destructive
            </Badge>
          )}
          {operation.important && !operation.destructive && (
            <Badge variant="info" className="px-1.5 py-0 text-[10px]">
              Common
            </Badge>
          )}
        </span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {operation.id}
        </span>
      </span>
    </label>
  );
}

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
  const savedOperations = useMemo(() => grant?.allowedOperations ?? [], [grant]);
  const [selected, setSelected] = useState(() => new Set(savedOperations));
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState<OperationAccessFilter>("all");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  const operations = useMemo(
    () => buildOperationViews(connection.operations, connection.provider),
    [connection.operations, connection.provider],
  );
  const filtered = useMemo(
    () => filterOperations(operations, { query, access, selected }),
    [operations, query, access, selected],
  );
  const groups = useMemo(() => groupOperationsByAccess(filtered), [filtered]);
  const summary = summariseSelection(connection.operations, selected);
  const dirty = !haveSameMembers(selected, savedOperations);
  const isFiltering = query.trim().length > 0 || access !== "all";
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((operation) => selected.has(operation.id));

  const accountLabel = connection.accountId
    ? `Account …${connection.accountId.slice(-6)}`
    : "Connected account";

  const updateSelection = (operationIds: Iterable<string>, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);

      for (const id of operationIds) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }

      return next;
    });
  };

  const changeFilter = (update: () => void) => {
    update();
    setVisibleLimit(PAGE_SIZE);
  };

  const hiddenCount = Math.max(0, filtered.length - visibleLimit);
  const renderedGroups = useMemo(
    () => pageOperationGroups(groups, visibleLimit),
    [groups, visibleLimit],
  );

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{connection.providerName}</p>
          <p className="text-xs text-muted-foreground">{accountLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.selected === 0
              ? `No access granted · ${summary.total} operations available`
              : `${summary.selected} of ${summary.total} operations granted · ${summary.read} read, ${summary.write} write${summary.destructive > 0 ? `, ${summary.destructive} destructive` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => setSelected(new Set(savedOperations))}
            >
              Discard
            </Button>
          )}
          <Button
            size="sm"
            variant={dirty ? "default" : "outline"}
            disabled={disabled || !dirty}
            onClick={() => onSave([...selected].sort((a, b) => a.localeCompare(b)))}
          >
            Save access
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={(value) => changeFilter(() => setQuery(value))}
          placeholder="Search operations…"
          aria-label={`Search ${connection.providerName} operations`}
        />
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={access}
          onValueChange={(value) => {
            if (value) {
              changeFilter(() => setAccess(value as OperationAccessFilter));
            }
          }}
          aria-label="Filter operations by access"
        >
          {ACCESS_FILTERS.map((filter) => (
            <ToggleGroupItem key={filter.value} value={filter.value} className="px-3 text-xs">
              {filter.label}
              {filter.value === "selected" && summary.selected > 0 && ` (${summary.selected})`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {isFiltering
            ? `${filtered.length} of ${operations.length} operations match`
            : `${operations.length} operations`}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            disabled={disabled || filtered.length === 0}
            onClick={() =>
              updateSelection(
                filtered.map((operation) => operation.id),
                !allFilteredSelected,
              )
            }
          >
            {allFilteredSelected ? "Deselect" : "Select"} {isFiltering ? "matching" : "all"}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              updateSelection(
                operations.filter((operation) => operation.access === "read").map((o) => o.id),
                true,
              )
            }
          >
            Allow all read
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={disabled || summary.selected === 0}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="max-h-[28rem] space-y-4 overflow-y-auto rounded-md border bg-surface p-2">
        {filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {access === "selected" && !query
              ? "Nothing selected yet."
              : "No operations match this search."}
          </p>
        )}
        {renderedGroups.map(({ group, visible }) => {
          const groupIds = group.operations.map((operation) => operation.id);
          const groupSelected = groupIds.filter((id) => selected.has(id)).length;

          return (
            <section key={group.access} aria-label={`${group.title} operations`}>
              <div className="flex items-center justify-between gap-2 px-2 pb-1">
                <div>
                  <span className="text-xs font-medium text-foreground">{group.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {groupSelected}/{group.operations.length}
                  </span>
                  <p className="text-[11px] text-muted-foreground">{group.description}</p>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() =>
                    updateSelection(groupIds, groupSelected !== group.operations.length)
                  }
                >
                  {groupSelected === group.operations.length ? "Deselect" : "Select"}{" "}
                  {group.title.toLowerCase()}
                </Button>
              </div>
              <div className="grid gap-0.5 lg:grid-cols-2">
                {visible.map((operation) => (
                  <OperationRow
                    key={operation.id}
                    controlId={`${connection.id}-${operation.id}`}
                    operation={operation}
                    checked={selected.has(operation.id)}
                    disabled={disabled}
                    onCheckedChange={(checked) => updateSelection([operation.id], checked)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {hiddenCount > 0 && (
          <div className="flex justify-center pb-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVisibleLimit((current) => current + PAGE_SIZE * 2)}
            >
              Show {Math.min(hiddenCount, PAGE_SIZE * 2)} more ({hiddenCount} hidden)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function TeammateConnectionGrantsPanel({ contextId }: { contextId: string }) {
  const { connections, grants, isLoading, error, update } = useTeammateConnectionGrants(contextId);

  return (
    <div className="space-y-3 rounded-lg border p-4">
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
          <ButtonLink href="/chat/plugins" size="sm" variant="outline">
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
