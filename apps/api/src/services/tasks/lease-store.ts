import type { LeaseStore } from "@ngriffin_uk/polychat-library-tasks";

import type { TaskRepository } from "~/repositories/TaskRepository";

export function taskLeaseStore(repository: TaskRepository): LeaseStore {
  return {
    renew: ({ taskId, ownerToken, expiresAt }) =>
      repository.renewTaskExecutionLease({ taskId, ownerToken, leaseExpiresAt: expiresAt }),
    isOwner: ({ taskId, ownerToken }) => repository.isTaskExecutionOwner({ taskId, ownerToken }),
  };
}
