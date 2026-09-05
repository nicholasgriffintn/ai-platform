import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormInput,
  FormSelect,
  Link,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  WorkAttentionItem,
  WorkAttentionKind,
  WorkAttentionResponse,
  WorkAttentionType,
} from "@ngriffin_uk/polychat-schemas";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import {
  AlertTriangle,
  CheckCircle2,
  CircleQuestionMark,
  Clock3,
  Inbox,
  LoaderCircle,
  ShieldQuestion,
} from "lucide-react";

export interface WorkAttentionFilters {
  kind?: WorkAttentionKind;
  workspaceId?: string;
  projectId?: string;
  ownerUserId?: number;
  type?: WorkAttentionType;
  from?: string;
  to?: string;
}

export interface WorkAttentionViewProps {
  items: WorkAttentionItem[];
  facets?: WorkAttentionResponse["facets"];
  filters: WorkAttentionFilters;
  total: number;
  offset: number;
  limit: number;
  isLoading?: boolean;
  errorMessage?: string;
  itemHref: (item: WorkAttentionItem) => string;
  onFiltersChange: (filters: WorkAttentionFilters) => void;
  onPageChange: (offset: number) => void;
}

const KIND_OPTIONS: Array<{ value: WorkAttentionKind; label: string }> = [
  { value: "approval", label: "Needs approval" },
  { value: "input", label: "Needs input" },
  { value: "review", label: "In review" },
  { value: "failed", label: "Failed or stalled" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Recently completed" },
];

const KIND_LABELS: Record<WorkAttentionKind, string> = {
  approval: "Needs approval",
  input: "Needs input",
  review: "In review",
  failed: "Failed or stalled",
  running: "Running",
  completed: "Recently completed",
};

function parseKind(value: string): WorkAttentionKind | undefined {
  return KIND_OPTIONS.find((option) => option.value === value)?.value;
}

function parseType(value: string): WorkAttentionType | undefined {
  return value === "task" || value === "run" ? value : undefined;
}

function kindIcon(kind: WorkAttentionKind) {
  if (kind === "approval") {
    return ShieldQuestion;
  }

  if (kind === "input") {
    return CircleQuestionMark;
  }

  if (kind === "failed") {
    return AlertTriangle;
  }

  if (kind === "completed") {
    return CheckCircle2;
  }

  if (kind === "running") {
    return LoaderCircle;
  }

  return Clock3;
}

function kindClass(kind: WorkAttentionKind): string {
  if (kind === "failed") {
    return "border-failure/40 text-failure";
  }

  if (kind === "completed") {
    return "border-success/40 text-success";
  }

  if (kind === "running") {
    return "border-active-work/40 text-active-work";
  }

  if (kind === "review") {
    return "border-creative/40 text-creative";
  }

  return "border-attention/40 text-attention";
}

export function WorkAttentionView({
  items,
  facets,
  filters,
  total,
  offset,
  limit,
  isLoading = false,
  errorMessage,
  itemHref,
  onFiltersChange,
  onPageChange,
}: WorkAttentionViewProps) {
  const projects = (facets?.projects ?? []).filter(
    (project) => !filters.workspaceId || project.workspaceId === filters.workspaceId,
  );
  const hasFilters = Object.values(filters).some((value) => value !== undefined && value !== "");

  if (errorMessage) {
    return <EmptyState title="Attention is unavailable" message={errorMessage} />;
  }

  return (
    <div className="space-y-5">
      <Card aria-label="Attention filters" className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormSelect
            label="State"
            value={filters.kind ?? ""}
            options={[{ value: "", label: "All" }, ...KIND_OPTIONS]}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                kind: parseKind(event.target.value),
              })
            }
          />
          <FormSelect
            label="Workspace"
            value={filters.workspaceId ?? ""}
            options={[
              { value: "", label: "All" },
              ...(facets?.workspaces ?? []).map(({ id, name }) => ({ value: id, label: name })),
            ]}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                workspaceId: event.target.value || undefined,
                projectId: undefined,
              })
            }
          />
          <FormSelect
            label="Project"
            value={filters.projectId ?? ""}
            options={[
              { value: "", label: "All" },
              ...projects.map(({ id, name }) => ({ value: id, label: name })),
            ]}
            onChange={(event) =>
              onFiltersChange({ ...filters, projectId: event.target.value || undefined })
            }
          />
          <FormSelect
            label="Owner"
            value={filters.ownerUserId ? String(filters.ownerUserId) : ""}
            options={[
              { value: "", label: "All" },
              ...(facets?.owners ?? []).map(({ id, name }) => ({
                value: String(id),
                label: name,
              })),
            ]}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                ownerUserId: event.target.value ? Number(event.target.value) : undefined,
              })
            }
          />
          <FormSelect
            label="Type"
            value={filters.type ?? ""}
            options={[
              { value: "", label: "All" },
              { value: "task", label: "Project task" },
              { value: "run", label: "Coding run" },
            ]}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                type: parseType(event.target.value),
              })
            }
          />
          <FormInput
            label="From"
            type="date"
            value={filters.from ?? ""}
            onChange={(event) =>
              onFiltersChange({ ...filters, from: event.target.value || undefined })
            }
          />
          <FormInput
            label="To"
            type="date"
            value={filters.to ?? ""}
            onChange={(event) =>
              onFiltersChange({ ...filters, to: event.target.value || undefined })
            }
          />
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasFilters}
              onClick={() => onFiltersChange({})}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-muted-foreground flex min-h-48 items-center justify-center gap-2 text-sm">
          <LoaderCircle className="polychat-motion-active-execution size-4" /> Loading attention…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="text-muted-foreground size-6" />}
          title={hasFilters ? "No work matches these filters" : "Nothing needs attention"}
          message={
            hasFilters
              ? "Clear or change the filters to see other authorised work."
              : "Approvals, questions, reviews, failures and active work will appear here."
          }
          className="min-h-56"
        />
      ) : (
        <ul className="space-y-2" aria-label="Attention items">
          {items.map((item) => {
            const Icon = kindIcon(item.kind);

            return (
              <li key={item.id}>
                <Link
                  href={itemHref(item)}
                  aria-label={item.title}
                  className="group block no-underline hover:!no-underline"
                >
                  <div className="border-border bg-surface group-hover:border-border-strong flex items-start gap-3 rounded-lg border p-3">
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        item.kind === "running" && "polychat-motion-active-execution",
                        kindClass(item.kind),
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={kindClass(item.kind)}>
                          {KIND_LABELS[item.kind]}
                        </Badge>
                        <span className="text-muted-foreground text-xs capitalize">
                          {item.type}
                        </span>
                        {item.isUnread ? (
                          <span className="text-human-action text-xs font-medium">Unread</span>
                        ) : null}
                        <span className="text-muted-foreground truncate text-xs">
                          {item.workspaceName} · {item.projectName}
                        </span>
                      </div>
                      <p className="text-foreground mt-1 line-clamp-2 text-sm font-medium">
                        {item.title}
                      </p>
                      {item.detail ? (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                          {item.detail}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground mt-2 text-xs">
                        {item.ownerName} · {formatDate(item.occurredAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {total > 0 ? (
        <nav aria-label="Attention pages" className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={offset === 0 || isLoading}
              onClick={() => onPageChange(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={offset + limit >= total || isLoading}
              onClick={() => onPageChange(offset + limit)}
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
