import type { TeammateConnectionOperation } from "@ngriffin_uk/polychat-schemas";
import { capitaliseFirst, normaliseComparableText } from "@ngriffin_uk/polychat-utility-core";

export type OperationAccessFilter = "all" | "read" | "write" | "selected";

export interface ConnectionOperationView extends TeammateConnectionOperation {
  label: string;
  searchText: string;
}

export interface OperationGroup {
  access: TeammateConnectionOperation["access"];
  title: string;
  description: string;
  operations: ConnectionOperationView[];
}

export function formatOperationLabel(operationId: string, provider: string): string {
  const prefix = `${provider}_`;
  const withoutPrefix = operationId.toLowerCase().startsWith(prefix.toLowerCase())
    ? operationId.slice(prefix.length)
    : operationId;
  const spaced = withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

  return capitaliseFirst(spaced) || operationId;
}

export function buildOperationViews(
  operations: readonly TeammateConnectionOperation[],
  provider: string,
): ConnectionOperationView[] {
  return operations
    .map((operation) => {
      const label = formatOperationLabel(operation.id, provider);

      return {
        ...operation,
        label,
        searchText: normaliseComparableText(`${label} ${operation.id}`),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function filterOperations(
  operations: readonly ConnectionOperationView[],
  params: { query: string; access: OperationAccessFilter; selected: ReadonlySet<string> },
): ConnectionOperationView[] {
  const terms = normaliseComparableText(params.query).split(" ").filter(Boolean);

  return operations.filter((operation) => {
    if (params.access === "selected" && !params.selected.has(operation.id)) {
      return false;
    }

    if (
      (params.access === "read" || params.access === "write") &&
      operation.access !== params.access
    ) {
      return false;
    }

    return terms.every((term) => operation.searchText.includes(term));
  });
}

export function groupOperationsByAccess(
  operations: readonly ConnectionOperationView[],
): OperationGroup[] {
  const groups: OperationGroup[] = [
    {
      access: "read",
      title: "Read",
      description: "Look things up without changing anything.",
      operations: [],
    },
    {
      access: "write",
      title: "Write",
      description: "Create, update or delete data on the account.",
      operations: [],
    },
  ];

  for (const operation of operations) {
    groups.find((group) => group.access === operation.access)?.operations.push(operation);
  }

  return groups.filter((group) => group.operations.length > 0);
}

export function pageOperationGroups(
  groups: readonly OperationGroup[],
  limit: number,
): Array<{ group: OperationGroup; visible: ConnectionOperationView[] }> {
  const pages: Array<{ group: OperationGroup; visible: ConnectionOperationView[] }> = [];
  let remaining = limit;

  for (const group of groups) {
    if (remaining <= 0) {
      break;
    }

    const visible = group.operations.slice(0, remaining);

    remaining -= visible.length;
    pages.push({ group, visible });
  }

  return pages;
}

export function summariseSelection(
  operations: readonly TeammateConnectionOperation[],
  selected: ReadonlySet<string>,
): { total: number; selected: number; read: number; write: number; destructive: number } {
  const summary = { total: operations.length, selected: 0, read: 0, write: 0, destructive: 0 };

  for (const operation of operations) {
    if (!selected.has(operation.id)) {
      continue;
    }

    summary.selected += 1;
    summary[operation.access] += 1;

    if (operation.destructive) {
      summary.destructive += 1;
    }
  }

  return summary;
}

export function haveSameMembers(left: ReadonlySet<string>, right: readonly string[]): boolean {
  return left.size === right.length && right.every((value) => left.has(value));
}
