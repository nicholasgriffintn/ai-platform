import { Button, EmptyState, Link, TextLink } from "@ngriffin_uk/polychat-component-ui";
import {
  projectTaskStatusLabels,
  type ProjectTask,
  type ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle, ArrowRight, CheckCircle2, ListChecks, Loader2 } from "lucide-react";

const HIGHLIGHTED_STATUSES = new Set<ProjectTaskStatus>(["running", "blocked", "review"]);
const MAX_VISIBLE_TASKS = 4;

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

  return <ListChecks className="text-zinc-400" size={14} />;
}

export interface ProjectTasksSummaryProps {
  tasks: ProjectTask[];
  boardHref: string;
  taskHref: (task: ProjectTask) => string;
  onCreateTask: () => void;
  isLoading?: boolean;
}

export function ProjectTasksSummary({
  tasks,
  boardHref,
  taskHref,
  onCreateTask,
  isLoading = false,
}: ProjectTasksSummaryProps) {
  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const needsAttention = openTasks.filter((task) => HIGHLIGHTED_STATUSES.has(task.status));
  const visible = (needsAttention.length > 0 ? needsAttention : openTasks).slice(
    0,
    MAX_VISIBLE_TASKS,
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tasks</h2>
        <TextLink href={boardHref} size="xs" trailingIcon={<ArrowRight size={13} />}>
          Open tasks
        </TextLink>
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading tasks…</p>
      ) : openTasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="text-zinc-400" size={24} />}
          title="No tasks yet"
          message="Capture work this project needs done, then run one and the assistant works it in its own conversation."
          action={
            <Button variant="primary" onClick={onCreateTask}>
              Add a task
            </Button>
          }
          className="min-h-[180px]"
        />
      ) : (
        <div className="space-y-2">
          {visible.map((task) => (
            <Link
              key={task.id}
              href={taskHref(task)}
              className="group block no-underline hover:!no-underline"
            >
              <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 group-hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:group-hover:border-zinc-600">
                {statusIcon(task.status)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-950 group-hover:underline dark:text-white">
                    {task.objective}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {projectTaskStatusLabels[task.status]}
                    {task.blockedDetail ? ` · ${task.blockedDetail}` : ""}
                  </p>
                </div>
                <ArrowRight size={16} className="text-zinc-400" />
              </div>
            </Link>
          ))}

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-zinc-500">
              {openTasks.length} open
              {needsAttention.length > 0 ? ` · ${needsAttention.length} needing a look` : ""}
            </p>
            <Button variant="secondary" size="sm" onClick={onCreateTask}>
              Add a task
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
