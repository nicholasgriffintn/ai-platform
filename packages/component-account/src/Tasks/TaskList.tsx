import { Card, EmptyState, getStatusIcon, ListItem } from "@ngriffin_uk/polychat-component-ui";
import type { Task } from "@ngriffin_uk/polychat-schemas";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { Loader2 } from "lucide-react";

const TASK_LABELS: Record<string, string> = {
  memory_synthesis: "Memory Synthesis",
  research_polling: "Research Polling",
  replicate_polling: "Replicate Polling",
  async_message_polling: "Async Message Polling",
};

function taskSublabel(task: Task): string {
  const parts = [`Created: ${formatDate(task.created_at)}`];

  if (task.completed_at) {
    parts.push(`Completed: ${formatDate(task.completed_at)}`);
  }

  if (task.error_message) {
    parts.push(`Error: ${task.error_message}`);
  }

  if (task.attempts !== undefined && task.attempts > 0) {
    parts.push(`Attempts: ${task.attempts}/${task.max_attempts || 3}`);
  }

  return parts.join(" • ");
}

function TaskItem({ task }: { task: Task }) {
  return (
    <ListItem
      icon={getStatusIcon(task.status || "pending")}
      label={`${TASK_LABELS[task.task_type] ?? task.task_type} - ${task.status?.toUpperCase()}`}
      sublabel={taskSublabel(task)}
      className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
    />
  );
}

export interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  limit?: number;
}

export function TaskList({ tasks, isLoading = false, limit = 10 }: TaskListProps) {
  return (
    <div className="space-y-8">
      <Card>
        <div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recent Tasks</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            View the status of your recent background tasks.
          </p>
        </div>
        <div className="px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              <span className="ml-2 text-zinc-500 dark:text-zinc-400">Loading tasks...</span>
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              message="No tasks found. Trigger a memory synthesis to get started!"
              className="bg-transparent dark:bg-transparent py-6 px-0"
            />
          ) : (
            <ul className="space-y-2">
              {tasks.slice(0, limit).map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
