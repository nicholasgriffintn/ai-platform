import {
  projectTaskNeedsAttention,
  type ProjectTask,
  type ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";

export type TaskQueueStatusFilter =
  | "all"
  | "attention"
  | "active"
  | "backlog"
  | "done"
  | "cancelled";

export interface TaskQueueFilters {
  query: string;
  status: TaskQueueStatusFilter;
  nodeId: string | null;
}

export const DEFAULT_TASK_QUEUE_FILTERS: TaskQueueFilters = {
  query: "",
  status: "all",
  nodeId: null,
};

function matchesStatus(status: ProjectTaskStatus, filter: TaskQueueStatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "attention":
      return status === "blocked" || status === "review";
    case "active":
      return status === "queued" || status === "running";
    case "backlog":
    case "done":
    case "cancelled":
      return status === filter;
  }

  return false;
}

export function hasTaskQueueFilters(filters: TaskQueueFilters): boolean {
  return Boolean(filters.query.trim()) || filters.status !== "all" || filters.nodeId !== null;
}

export function filterTaskQueue(
  tasks: readonly ProjectTask[],
  filters: TaskQueueFilters,
): ProjectTask[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return tasks.filter((task) => {
    if (
      filters.status === "attention"
        ? !projectTaskNeedsAttention(task)
        : !matchesStatus(task.status, filters.status)
    ) {
      return false;
    }

    if (filters.nodeId && task.nodeId !== filters.nodeId) {
      return false;
    }

    return !query || task.objective.toLocaleLowerCase().includes(query);
  });
}
