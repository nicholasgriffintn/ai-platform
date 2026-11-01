import {
  Badge,
  Button,
  Link,
  PageStatus,
  SegmentedControl,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import { useAdminTasks } from "@ngriffin_uk/polychat-library-react";
import type { AdminTask, AdminTaskTypeSummary, AdminTaskView } from "@ngriffin_uk/polychat-schemas";
import { formatElapsedMs, formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { X } from "lucide-react";
import { useSearchParams } from "react-router";

import { ADMIN_PATHS } from "../admin-paths.js";
import {
  TASK_STATUS_TONE,
  TASK_VIEW_OPTIONS,
  sumTaskTypes,
  type TaskTotals,
} from "./task-display.js";

const TILES: readonly { key: keyof TaskTotals; label: string; hint: string }[] = [
  { key: "running", label: "Running", hint: "In a step right now" },
  { key: "waiting", label: "Waiting", hint: "Due, not yet started" },
  { key: "scheduled", label: "Scheduled", hint: "Asleep until later" },
  { key: "suspended", label: "Waiting on someone", hint: "Paused for a person" },
  { key: "failed", label: "Failed today", hint: "Out of attempts" },
  { key: "completed", label: "Finished today", hint: "Settled cleanly" },
];

function isTaskView(value: string | null): value is AdminTaskView {
  return TASK_VIEW_OPTIONS.some((option) => option.id === value);
}

function describeProgress(task: AdminTask): string {
  if (task.status === "running") {
    return `Running since ${formatRelativeTime(task.last_attempted_at ?? task.updated_at ?? task.created_at)}`;
  }

  if (task.scheduled_at && Date.parse(task.scheduled_at) > Date.now()) {
    return `Due ${new Date(task.scheduled_at).toLocaleString()}`;
  }

  if (task.completed_at) {
    return `Finished ${formatRelativeTime(task.completed_at)}`;
  }

  return `Updated ${formatRelativeTime(task.updated_at ?? task.created_at)}`;
}

function TypeRow({
  type,
  selected,
  onSelect,
}: {
  type: AdminTaskTypeSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 hover:bg-selection/40",
        selected && "bg-selection/60",
      )}
    >
      <td className="py-2 pr-3">
        <button
          type="button"
          aria-pressed={selected}
          onClick={onSelect}
          className="font-mono text-xs text-foreground hover:underline"
        >
          {type.task_type}
        </button>
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">{type.running || "–"}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{type.waiting || "–"}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{type.scheduled || "–"}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{type.suspended || "–"}</td>
      <td className={cn("py-2 pr-3 text-right tabular-nums", type.failed > 0 && "text-failure")}>
        {type.failed || "–"}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">{type.completed || "–"}</td>
      <td className="py-2 pr-3 text-right text-muted-foreground tabular-nums">
        {type.average_turnaround_ms === null ? "–" : formatElapsedMs(type.average_turnaround_ms)}
      </td>
      <td className="py-2 text-right text-muted-foreground">
        {type.oldest_open ? formatRelativeTime(type.oldest_open) : "–"}
      </td>
    </tr>
  );
}

function TaskRow({ task }: { task: AdminTask }) {
  return (
    <li>
      <Link
        href={ADMIN_PATHS.task(task.id)}
        className="block rounded-md border border-border/60 p-3 text-sm hover:bg-selection/40"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs text-foreground">{task.task_type}</span>
            <Badge variant={TASK_STATUS_TONE[task.status]}>{task.status}</Badge>
          </span>
          <span className="text-xs text-muted-foreground">{describeProgress(task)}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {task.user_id === null ? "System" : `User ${task.user_id}`} · attempt {task.attempts} of{" "}
          {task.max_attempts} · <span className="font-mono">{task.id}</span>
        </div>
        {task.error_message ? (
          <p className="mt-1 line-clamp-2 text-xs text-failure">{task.error_message}</p>
        ) : null}
      </Link>
    </li>
  );
}

export function AdminTasksOverview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get("view");
  const view: AdminTaskView = isTaskView(requestedView) ? requestedView : "active";
  const taskType = searchParams.get("type") ?? undefined;
  const { data, isLoading, error } = useAdminTasks(view, taskType, true);
  const totals = sumTaskTypes(data?.types ?? []);

  const updateFilters = (next: { view?: AdminTaskView; type?: string | null }) => {
    const params = new URLSearchParams(searchParams);
    const nextType = next.type === undefined ? taskType : next.type;

    params.set("view", next.view ?? view);

    if (nextType) {
      params.set("type", nextType);
    } else {
      params.delete("type");
    }

    setSearchParams(params);
  };

  if (error) {
    return <PageStatus message={error.message} />;
  }

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map((tile) => (
          <div key={tile.key} className="rounded-md border border-border/60 p-3">
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p
              className={cn(
                "mt-1 font-display text-2xl text-foreground tabular-nums",
                tile.key === "failed" && totals.failed > 0 && "text-failure",
              )}
            >
              {isLoading ? "…" : totals[tile.key]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-display text-xl text-foreground">By type</h2>
          <p className="text-sm text-muted-foreground">
            Open work now, plus what failed or finished in the last day. Pick a type to narrow the
            list below.
          </p>
        </div>
        {data && data.types.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-normal">Type</th>
                  <th className="py-2 pr-3 text-right font-normal">Running</th>
                  <th className="py-2 pr-3 text-right font-normal">Waiting</th>
                  <th className="py-2 pr-3 text-right font-normal">Scheduled</th>
                  <th className="py-2 pr-3 text-right font-normal">On someone</th>
                  <th className="py-2 pr-3 text-right font-normal">Failed</th>
                  <th className="py-2 pr-3 text-right font-normal">Finished</th>
                  <th className="py-2 pr-3 text-right font-normal">Average turnaround</th>
                  <th className="py-2 text-right font-normal">Oldest open</th>
                </tr>
              </thead>
              <tbody>
                {data.types.map((type) => (
                  <TypeRow
                    key={type.task_type}
                    type={type}
                    selected={type.task_type === taskType}
                    onSelect={() =>
                      updateFilters({ type: type.task_type === taskType ? null : type.task_type })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Counting the flock..." : "Nothing has stirred in the last day."}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-foreground">Tasks</h2>
          <div className="flex flex-wrap items-center gap-2">
            {taskType ? (
              <Button
                variant="outline"
                size="sm"
                icon={<X size={14} />}
                onClick={() => updateFilters({ type: null })}
              >
                {taskType}
              </Button>
            ) : null}
            <SegmentedControl
              label="Task views"
              options={TASK_VIEW_OPTIONS}
              value={view}
              onChange={(next) => updateFilters({ view: next })}
            />
          </div>
        </div>
        {isLoading ? (
          <PageStatus message="Reading the perch..." />
        ) : data && data.tasks.length > 0 ? (
          <ul className="grid gap-2">
            {data.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing here. The queue is clear.</p>
        )}
      </section>
    </div>
  );
}
