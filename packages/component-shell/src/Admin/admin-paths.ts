export const ADMIN_PATHS = {
  root: "/admin",
  tasks: "/admin/tasks",
  task: (taskId: string) => `/admin/tasks/${encodeURIComponent(taskId)}`,
};
