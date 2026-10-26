import { cn, EmptyState, Link } from "@ngriffin_uk/polychat-component-ui";
import {
  projectTaskBlockedReasonLabels,
  projectTaskPriorityLabels,
  projectTaskStatusLabels,
  type ProjectTask,
  type ProjectTaskPriority,
  type ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";
import {
  DAY_MS,
  groupBy,
  initialsOf,
  parseStoredTimestamp,
} from "@ngriffin_uk/polychat-utility-core";
import { ListTodo } from "lucide-react";

import { describeWorkActor, type WorkDirectory } from "./work-actors";

const STATUS_ORDER: readonly ProjectTaskStatus[] = [
  "running",
  "queued",
  "review",
  "blocked",
  "backlog",
  "done",
  "cancelled",
];

const PRIORITY_LEVEL: Record<ProjectTaskPriority, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const TIMELINE_DAYS = 21;

export interface WorkTaskViewProps {
  tasks: readonly ProjectTask[];
  directory: WorkDirectory;
  taskHref: (task: ProjectTask) => string;
  emptyMessage?: string;
}

function PriorityBars({ priority }: { priority: ProjectTaskPriority }) {
  const level = PRIORITY_LEVEL[priority];

  return (
    <span
      className="inline-grid h-3 w-3.5 shrink-0 grid-cols-3 items-end gap-px"
      title={projectTaskPriorityLabels[priority]}
      aria-label={projectTaskPriorityLabels[priority]}
    >
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            "rounded-[1px]",
            bar === 1 ? "h-1.5" : bar === 2 ? "h-2" : "h-3",
            level === 4 ? "bg-failure" : level >= bar ? "bg-foreground/80" : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

function StatusDot({ status }: { status: ProjectTaskStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2",
        status === "done" && "border-success bg-success",
        status === "cancelled" && "border-border bg-border",
        status === "blocked" && "border-failure bg-failure",
        status === "review" && "border-active-work",
        (status === "running" || status === "queued") && "border-attention",
        status === "backlog" && "border-muted-foreground",
      )}
    />
  );
}

export function WorkActorChip({
  name,
  isTeammate,
  isEmpty = false,
}: {
  name: string;
  isTeammate: boolean;
  isEmpty?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      {isEmpty ? (
        <span
          aria-hidden
          className="h-5 w-5 shrink-0 rounded-full border border-dashed border-border-strong"
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
            isTeammate ? "bg-active-work/15 text-active-work" : "bg-selection text-foreground",
          )}
        >
          {initialsOf(name)}
        </span>
      )}
      <span className={cn("truncate", !isEmpty && "text-foreground/80")}>{name}</span>
    </span>
  );
}

function RowTag({ tone, children }: { tone: "info" | "attention" | "neutral"; children: string }) {
  return (
    <span
      className={cn(
        "max-w-48 truncate rounded-full border px-2 py-0.5 text-[11px] leading-4",
        tone === "info" && "border-active-work/25 bg-active-work/10 text-active-work",
        tone === "attention" && "border-attention/30 bg-attention/10 text-attention",
        tone === "neutral" && "border-border bg-selection/60 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function WorkTaskRow({
  task,
  directory,
  href,
  childCount = 0,
  depth = 0,
}: {
  task: ProjectTask;
  directory: WorkDirectory;
  href: string;
  childCount?: number;
  depth?: number;
}) {
  const owner = describeWorkActor(task.owner, directory);

  return (
    <Link
      href={href}
      title={task.objective}
      className="group grid min-h-10 grid-cols-[1rem_4rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 text-sm text-foreground no-underline last:border-b-0 hover:bg-selection/50 hover:!no-underline md:grid-cols-[1rem_4rem_minmax(0,1fr)_auto_9.5rem]"
      style={depth ? { paddingLeft: `${1 + depth * 1.5}rem` } : undefined}
    >
      <PriorityBars priority={task.priority} />
      <span className="truncate font-mono text-xs text-muted-foreground tabular-nums">
        {task.key ?? task.id.slice(0, 6)}
      </span>
      <span className="flex min-w-0 items-center gap-2.5">
        <StatusDot status={task.status} />
        <span className="truncate">{task.objective}</span>
      </span>
      <span className="flex items-center justify-end gap-1.5">
        {task.kind === "case" ? <RowTag tone="info">Case</RowTag> : null}
        {task.status === "blocked" && task.blockedReason ? (
          <span className="hidden lg:inline-flex">
            <RowTag tone="attention">{projectTaskBlockedReasonLabels[task.blockedReason]}</RowTag>
          </span>
        ) : null}
        {childCount > 0 ? <RowTag tone="neutral">{`${childCount} sub-tasks`}</RowTag> : null}
        {task.dueAt ? (
          <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
            {new Date(task.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        ) : null}
      </span>
      <span className="hidden min-w-0 md:block">
        <WorkActorChip
          name={owner}
          isTeammate={task.owner?.type === "teammate"}
          isEmpty={!task.owner}
        />
      </span>
    </Link>
  );
}

function countChildren(tasks: readonly ProjectTask[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    if (task.parentTaskId) {
      counts.set(task.parentTaskId, (counts.get(task.parentTaskId) ?? 0) + 1);
    }
  }

  return counts;
}

export function WorkTaskList({ tasks, directory, taskHref, emptyMessage }: WorkTaskViewProps) {
  const children = countChildren(tasks);
  const groups = STATUS_ORDER.map((status) => ({
    status,
    tasks: tasks
      .filter((task) => task.status === status)
      .sort((left, right) => PRIORITY_LEVEL[right.priority] - PRIORITY_LEVEL[left.priority]),
  })).filter((group) => group.tasks.length > 0);

  if (groups.length === 0) {
    return (
      <EmptyState
        variant="inset"
        icon={<ListTodo size={22} className="text-muted-foreground" />}
        message={emptyMessage ?? "Nothing here yet."}
        className="min-h-[180px]"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {groups.map((group) => (
        <section key={group.status} aria-label={projectTaskStatusLabels[group.status]}>
          <h3 className="flex h-9 items-center gap-2.5 border-b border-border bg-selection/40 px-4 text-xs font-medium text-foreground">
            <StatusDot status={group.status} />
            {projectTaskStatusLabels[group.status]}
            <span className="font-mono font-normal text-muted-foreground">
              {group.tasks.length}
            </span>
          </h3>
          {group.tasks.map((task) => (
            <WorkTaskRow
              key={task.id}
              task={task}
              directory={directory}
              href={taskHref(task)}
              childCount={children.get(task.id) ?? 0}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

export function WorkTaskTree({ tasks, directory, taskHref, emptyMessage }: WorkTaskViewProps) {
  const known = new Set(tasks.map((task) => task.id));
  const roots = tasks.filter((task) => !task.parentTaskId || !known.has(task.parentTaskId));
  const children = groupBy(tasks, (task) => task.parentTaskId);
  const childrenOf = (parentId: string) => children.get(parentId) ?? [];
  const progressByTask = new Map<string, { done: number; total: number }>();
  const progress = (task: ProjectTask): { done: number; total: number } => {
    const known = progressByTask.get(task.id);

    if (known) {
      return known;
    }

    const result = { done: 0, total: 0 };

    for (const child of childrenOf(task.id)) {
      const nested = progress(child);

      result.done += (child.status === "done" ? 1 : 0) + nested.done;
      result.total += 1 + nested.total;
    }

    progressByTask.set(task.id, result);

    return result;
  };

  const renderBranch = (task: ProjectTask, depth: number): React.ReactNode => {
    const branch = progress(task);

    return (
      <div key={task.id}>
        <div className="relative">
          <WorkTaskRow
            task={task}
            directory={directory}
            href={taskHref(task)}
            childCount={childrenOf(task.id).length}
            depth={depth}
          />
          {branch.total > 0 ? (
            <span
              aria-hidden
              className="absolute bottom-0 left-0 h-0.5 bg-success"
              style={{ width: `${(branch.done / branch.total) * 100}%` }}
            />
          ) : null}
        </div>
        {childrenOf(task.id).map((child) => renderBranch(child, depth + 1))}
      </div>
    );
  };

  if (roots.length === 0) {
    return (
      <EmptyState
        variant="inset"
        icon={<ListTodo size={22} className="text-muted-foreground" />}
        message={emptyMessage ?? "Nothing here yet."}
        className="min-h-[180px]"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {roots.map((task) => renderBranch(task, 0))}
    </div>
  );
}

export function WorkTaskTimeline({ tasks, directory, taskHref, emptyMessage }: WorkTaskViewProps) {
  const dated = tasks.filter((task) => task.status !== "cancelled");
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const start = today.getTime() - 3 * DAY_MS;
  const end = start + TIMELINE_DAYS * DAY_MS;
  const position = (time: number) =>
    Math.min(100, Math.max(0, ((time - start) / (end - start)) * 100));

  if (dated.length === 0) {
    return (
      <EmptyState
        variant="inset"
        icon={<ListTodo size={22} className="text-muted-foreground" />}
        message={
          emptyMessage ??
          "Tasks appear here once they exist. Dates come from start and due dates, or from when the work actually ran."
        }
        className="min-h-[180px]"
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <div className="min-w-[44rem]">
        <div className="grid grid-cols-[18rem_minmax(0,1fr)] border-b border-border text-[10px] text-muted-foreground">
          <span className="px-3 py-1.5">Task</span>
          <div className="relative h-6">
            {Array.from({ length: TIMELINE_DAYS / 7 + 1 }, (_, week) => (
              <span
                key={week}
                className={cn(
                  "absolute top-1.5 font-mono",
                  week === 0
                    ? ""
                    : week === TIMELINE_DAYS / 7
                      ? "-translate-x-full"
                      : "-translate-x-1/2",
                )}
                style={{ left: `${position(start + week * 7 * DAY_MS)}%` }}
              >
                {new Date(start + week * 7 * DAY_MS).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            ))}
          </div>
        </div>
        {dated.map((task) => {
          const from = parseStoredTimestamp(task.startAt ?? task.startedAt ?? task.createdAt);
          const to = task.dueAt
            ? parseStoredTimestamp(task.dueAt)
            : task.completedAt
              ? parseStoredTimestamp(task.completedAt)
              : Math.max(Date.now(), from + DAY_MS);
          const left = position(Math.min(from, to));
          const width = Math.max(1.5, position(Math.max(from, to)) - left);
          const late = task.dueAt && task.status !== "done" && to < Date.now();

          return (
            <Link
              key={task.id}
              href={taskHref(task)}
              className="grid grid-cols-[18rem_minmax(0,1fr)] items-center border-b border-border text-sm text-foreground no-underline last:border-b-0 hover:bg-selection/40 hover:!no-underline"
            >
              <span className="truncate px-3 py-2">
                <span className="mr-2 font-mono text-xs text-muted-foreground">{task.key}</span>
                {task.objective}
              </span>
              <span className="relative h-8">
                <span
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-border-strong"
                  style={{ left: `${position(today.getTime())}%` }}
                />
                <span
                  title={`${describeWorkActor(task.owner, directory)} · ${projectTaskStatusLabels[task.status]}`}
                  className={cn(
                    "absolute top-2 h-4 rounded",
                    task.status === "done"
                      ? "bg-success/70"
                      : late
                        ? "bg-failure/70"
                        : task.status === "blocked"
                          ? "bg-failure/50"
                          : "bg-active-work/60",
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
