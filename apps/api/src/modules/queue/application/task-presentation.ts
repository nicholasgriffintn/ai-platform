import type { Task } from "~/infrastructure/database/schema";

export type PublicTask = Omit<Task, "execution_owner_token">;

export function presentPublicTask(task: Task): PublicTask {
  const { execution_owner_token: _executionOwnerToken, ...publicTask } = task;

  return publicTask;
}
