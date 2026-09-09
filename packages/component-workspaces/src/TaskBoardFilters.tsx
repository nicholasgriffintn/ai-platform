import { Button, FormSelect, SearchInput } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectFlow } from "@ngriffin_uk/polychat-schemas";

import {
  hasTaskQueueFilters,
  type TaskQueueFilters,
  type TaskQueueStatusFilter,
} from "./task-board-filters";

const STATUS_OPTIONS: Array<{ label: string; value: TaskQueueStatusFilter }> = [
  { label: "All statuses", value: "all" },
  { label: "Needs attention", value: "attention" },
  { label: "Active", value: "active" },
  { label: "Backlog", value: "backlog" },
  { label: "Completed", value: "done" },
  { label: "Cancelled", value: "cancelled" },
];

export interface TaskBoardFiltersProps {
  filters: TaskQueueFilters;
  flow: ProjectFlow | null;
  matchCount: number;
  totalCount: number;
  onChange: (filters: TaskQueueFilters) => void;
  onClear: () => void;
}

export function TaskBoardFilters({
  filters,
  flow,
  matchCount,
  totalCount,
  onChange,
  onClear,
}: TaskBoardFiltersProps) {
  const isFiltered = hasTaskQueueFilters(filters);

  return (
    <div className="border-b border-border bg-surface-elevated/70 px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput
          aria-label="Search work queue"
          className="w-full xl:max-w-md"
          placeholder="Search work..."
          value={filters.query}
          onChange={(query) => onChange({ ...filters, query })}
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <FormSelect
            aria-label="Filter work by status"
            className="min-w-40"
            fullWidth={false}
            value={filters.status}
            onValueChange={(value) => {
              const status = STATUS_OPTIONS.find((option) => option.value === value)?.value;

              if (status) {
                onChange({ ...filters, status });
              }
            }}
            options={STATUS_OPTIONS}
          />
          {flow ? (
            <FormSelect
              aria-label="Filter work by stage"
              className="min-w-36"
              fullWidth={false}
              value={filters.stageId ?? ""}
              onValueChange={(value) => onChange({ ...filters, stageId: value || null })}
              options={[
                { label: "All stages", value: "" },
                ...flow.stages.map((stage) => ({ label: stage.name, value: stage.id })),
              ]}
            />
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {matchCount === totalCount ? `${totalCount} items` : `${matchCount} of ${totalCount}`}
          </span>
          {isFiltered ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
