import type { Task } from "~/lib/database/schema";

export type PublicTask = Omit<Task, "execution_owner_token" | "execution_lease_expires_at">;

export function presentPublicTask(task: Task): PublicTask {
  const {
    execution_owner_token: _executionOwnerToken,
    execution_lease_expires_at: _executionLeaseExpiresAt,
    ...publicTask
  } = task;

  return publicTask;
}
