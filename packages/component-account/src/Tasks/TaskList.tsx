import { EmptyState, getStatusIcon, ListItem } from "@ngriffin_uk/polychat-component-ui";
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
      className="border border-border bg-surface"
    />
  );
}

export interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  limit?: number;
}

export function TaskList({ tasks, isLoading = false, limit = 10 }: TaskListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading tasks...</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        message="Nothing is running in the background right now."
        className="bg-transparent px-0 py-6 dark:bg-transparent"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.slice(0, limit).map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  );
}
