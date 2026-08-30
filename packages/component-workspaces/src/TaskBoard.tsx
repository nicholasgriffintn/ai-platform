import { Button, EmptyState, Link } from "@ngriffin_uk/polychat-component-ui";
import {
  isTerminalProjectTaskStatus,
  PROJECT_TASK_BOARD_COLUMNS,
  projectTaskBlockedReasonLabels,
  projectTaskStatusLabels,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronUp,
  ListChecks,
  Loader2,
  Play,
} from "lucide-react";

const NO_PENDING_TASKS: string[] = [];

export interface TaskBoardColumn {
  id: string;
  title: string;
  tasks: ProjectTask[];
}

export interface TaskBoardMemberSummary {
  userId: number;
  name: string | null;
}

export interface TaskBoardProps {
  tasks: ProjectTask[];
  flow: ProjectFlow | null;
  members: TaskBoardMemberSummary[];
  pendingTaskIds?: string[];
  taskHref: (task: ProjectTask) => string;
  onStartTask: (task: ProjectTask) => void;
  onAcceptTask: (task: ProjectTask) => void;
  onCreateTask: () => void;
  canCreateTask: boolean;
}

export function buildBoardColumns(tasks: ProjectTask[]): TaskBoardColumn[] {
  return PROJECT_TASK_BOARD_COLUMNS.map((status) => ({
    id: status,
    title: projectTaskStatusLabels[status],
    tasks: tasks.filter((task) => task.status === status),
  }));
}

const STATUS_ACCENT: Record<ProjectTaskStatus, string> = {
  backlog: "bg-zinc-300 dark:bg-zinc-600",
  queued: "bg-sky-400",
  running: "bg-blue-500",
  blocked: "bg-amber-500",
  review: "bg-emerald-500",
  done: "bg-zinc-400 dark:bg-zinc-600",
  cancelled: "bg-zinc-300 dark:bg-zinc-700",
};

function statusIcon(status: ProjectTaskStatus) {
  if (status === "running") {
    return <Loader2 className="animate-spin text-blue-500" size={13} />;
  }

  if (status === "blocked") {
    return <AlertTriangle className="text-amber-500" size={13} />;
  }

  if (status === "review") {
    return <CheckCircle2 className="text-emerald-500" size={13} />;
  }

  if (status === "done") {
    return <Check className="text-zinc-400" size={13} />;
  }

  return null;
}

function initials(name: string | null): string {
  if (!name) {
    return "?";
  }

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function dueLabel(dueAt: string): { text: string; overdue: boolean } {
  const due = new Date(dueAt);
  const days = Math.round((due.getTime() - Date.now()) / 86_400_000);

  if (days < 0) {
    return { text: `${Math.abs(days)}d overdue`, overdue: true };
  }

  if (days === 0) {
    return { text: "Due today", overdue: false };
  }

  return { text: `Due in ${days}d`, overdue: false };
}

function TaskCard({
  task,
  flow,
  members,
  href,
  isPending,
  onStart,
  onAccept,
}: {
  task: ProjectTask;
  flow: ProjectFlow | null;
  members: TaskBoardMemberSummary[];
  href: string;
  isPending: boolean;
  onStart: () => void;
  onAccept: () => void;
}) {
  const owner = members.find((member) => member.userId === task.assigneeUserId);
  const stage = flow?.stages.find((candidate) => candidate.id === task.stageId);
  const canStart = !isTerminalProjectTaskStatus(task.status) && task.status !== "running";
  const due = task.dueAt ? dueLabel(task.dueAt) : null;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-white transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <span className={`absolute inset-y-0 left-0 w-0.5 ${STATUS_ACCENT[task.status]}`} />

      <div className="space-y-2.5 py-3 pr-3 pl-4">
        <Link href={href} className="block no-underline hover:!no-underline">
          <p className="line-clamp-3 text-sm leading-snug font-medium text-zinc-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
            {task.objective}
          </p>
        </Link>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zinc-500">
          {statusIcon(task.status)}
          {task.priority === "high" && (
            <span className="inline-flex items-center gap-0.5 font-medium text-rose-600 dark:text-rose-400">
              <ChevronUp size={12} /> High
            </span>
          )}
          {stage && <span className="text-zinc-600 dark:text-zinc-400">{stage.name}</span>}
          {task.acceptanceCriteria.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks size={12} />
              {task.acceptanceCriteria.length}
            </span>
          )}
          {due && (
            <span
              className={`inline-flex items-center gap-1 ${due.overdue ? "text-rose-600 dark:text-rose-400" : ""}`}
            >
              <CalendarClock size={12} />
              {due.text}
            </span>
          )}
          {task.dependsOnTaskIds.length > 0 && (
            <span>blocked by {task.dependsOnTaskIds.length}</span>
          )}
        </div>

        {task.status === "blocked" && task.blockedReason && (
          <p className="line-clamp-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {task.blockedDetail ?? projectTaskBlockedReasonLabels[task.blockedReason]}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          {owner ? (
            <span
              title={owner.name ?? undefined}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
            >
              {initials(owner.name)}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-400">Unassigned</span>
          )}

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {task.status === "review" && (
              <Button variant="primary" size="sm" onClick={onAccept} disabled={isPending}>
                Accept
              </Button>
            )}
            {canStart && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onStart}
                disabled={isPending}
                aria-label={task.status === "backlog" ? "Run task" : "Run task again"}
              >
                <Play size={12} />
                {task.status === "backlog" ? "Run" : "Again"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskBoard({
  tasks,
  flow,
  members,
  pendingTaskIds = NO_PENDING_TASKS,
  taskHref,
  onStartTask,
  onAcceptTask,
  onCreateTask,
  canCreateTask,
}: TaskBoardProps) {
  const columns = buildBoardColumns(tasks);

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<ListChecks className="text-zinc-400" size={24} />}
        title="Nothing on the board"
        message="Add a task to capture work the project needs done. The assistant can work one when you say so."
        action={
          canCreateTask ? (
            <Button variant="primary" onClick={onCreateTask}>
              Add a task
            </Button>
          ) : undefined
        }
        className="min-h-[260px]"
      />
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {columns.map((column) => (
          <section
            key={column.id}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-zinc-50 p-2 dark:bg-zinc-900/40"
          >
            <header className="flex items-center justify-between px-2 py-1.5">
              <h3 className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
                {column.title}
              </h3>
              <span className="rounded-full bg-zinc-200 px-1.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {column.tasks.length}
              </span>
            </header>
            <div className="min-h-[80px] space-y-2">
              {column.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  flow={flow}
                  members={members}
                  href={taskHref(task)}
                  isPending={pendingTaskIds.includes(task.id)}
                  onStart={() => onStartTask(task)}
                  onAccept={() => onAcceptTask(task)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
