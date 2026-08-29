import { Badge, Button, EmptyState, Link } from "@ngriffin_uk/polychat-component-ui";
import {
  isTerminalProjectTaskStatus,
  PROJECT_TASK_BOARD_COLUMNS,
  projectTaskBlockedReasonLabels,
  projectTaskStatusLabels,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle, CheckCircle2, ListChecks, Loader2, Play, User } from "lucide-react";

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

function statusIcon(status: ProjectTaskStatus) {
  if (status === "running") {
    return <Loader2 className="animate-spin text-blue-500" size={14} />;
  }

  if (status === "blocked") {
    return <AlertTriangle className="text-amber-500" size={14} />;
  }

  if (status === "review") {
    return <CheckCircle2 className="text-emerald-500" size={14} />;
  }

  return null;
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
  const assignee = members.find((member) => member.userId === task.assigneeUserId);
  const stage = flow?.stages.find((candidate) => candidate.id === task.stageId);
  const canStart = !isTerminalProjectTaskStatus(task.status) && task.status !== "running";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-none dark:border-zinc-800 dark:bg-zinc-900">
      <Link href={href} className="block no-underline hover:!no-underline">
        <p className="line-clamp-3 text-sm font-medium text-zinc-950 hover:underline dark:text-white">
          {task.objective}
        </p>
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {statusIcon(task.status)}
        {stage && (
          <Badge variant="secondary" className="text-[11px]">
            {stage.name}
          </Badge>
        )}
        {task.source === "model" && (
          <Badge variant="outline" className="text-[11px]">
            Drafted by assistant
          </Badge>
        )}
        {assignee && (
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            <User size={11} />
            {assignee.name ?? "Member"}
          </span>
        )}
      </div>

      {task.status === "blocked" && task.blockedReason && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {task.blockedDetail ?? projectTaskBlockedReasonLabels[task.blockedReason]}
        </p>
      )}

      {(canStart || task.status === "review") && (
        <div className="mt-3 flex gap-2">
          {task.status === "review" ? (
            <Button variant="primary" size="sm" onClick={onAccept} disabled={isPending}>
              Accept
            </Button>
          ) : null}
          {canStart ? (
            <Button variant="secondary" size="sm" onClick={onStart} disabled={isPending}>
              <Play size={12} />
              {task.status === "blocked" || task.status === "review" ? "Run again" : "Run"}
            </Button>
          ) : null}
        </div>
      )}
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
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-4 pb-2">
        {columns.map((column) => (
          <section key={column.id} className="w-72 shrink-0">
            <header className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
                {column.title}
              </h3>
              <span className="text-xs text-zinc-500">{column.tasks.length}</span>
            </header>
            <div className="space-y-2">
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
              {column.tasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
                  Nothing here
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
