import type { TaskRepository } from "~/repositories/TaskRepository";

import type { TaskExecutionLease } from "./TaskHandler";

export const TASK_EXECUTION_LEASE_DURATION_MS = 5 * 60 * 1000;
export const TASK_EXECUTION_LEASE_RENEWAL_INTERVAL_MS = 60 * 1000;

export class TaskExecutionLeaseBusyError extends Error {
  readonly delaySeconds: number;

  constructor(delaySeconds: number) {
    super("This queued task still has a live execution owner");
    this.name = "TaskExecutionLeaseBusyError";
    this.delaySeconds = Math.max(1, delaySeconds);
  }
}

export class TaskExecutionOwnershipLostError extends Error {
  constructor() {
    super("This queued task is now owned by another delivery");
    this.name = "TaskExecutionOwnershipLostError";
  }
}

export function isTaskExecutionOwnershipLostError(
  error: unknown,
): error is TaskExecutionOwnershipLostError {
  return error instanceof TaskExecutionOwnershipLostError;
}

export interface ManagedTaskExecutionLease extends TaskExecutionLease {
  stop(): Promise<void>;
}

export function taskExecutionLeaseExpiry(now = Date.now()): string {
  return new Date(now + TASK_EXECUTION_LEASE_DURATION_MS).toISOString();
}

export function taskExecutionLeaseRetryDelay(expiresAt: string, now = Date.now()): number {
  const remainingMs = Date.parse(expiresAt) - now;

  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export function createTaskExecutionLease(params: {
  repository: TaskRepository;
  taskId: string;
  ownerToken: string;
  initialExpiresAt: string;
}): ManagedTaskExecutionLease {
  let expiresAt = params.initialExpiresAt;
  let lost = false;
  let stopped = false;
  let renewalTimer: ReturnType<typeof setTimeout> | undefined;
  let renewalInFlight: Promise<void> | undefined;

  const clearRenewal = () => {
    if (renewalTimer !== undefined) {
      clearTimeout(renewalTimer);
      renewalTimer = undefined;
    }
  };

  const markLost = () => {
    lost = true;
    clearRenewal();
  };

  const scheduleRenewal = () => {
    clearRenewal();

    if (stopped || lost) {
      return;
    }

    renewalTimer = setTimeout(() => {
      renewalTimer = undefined;
      renewalInFlight = renew().finally(() => {
        renewalInFlight = undefined;
      });
    }, TASK_EXECUTION_LEASE_RENEWAL_INTERVAL_MS);
  };

  const renew = async () => {
    if (stopped || lost) {
      return;
    }

    const renewed = await params.repository.renewTaskExecutionLease({
      taskId: params.taskId,
      ownerToken: params.ownerToken,
      leaseExpiresAt: taskExecutionLeaseExpiry(),
    });

    if (!renewed) {
      markLost();

      return;
    }

    expiresAt = renewed;
    scheduleRenewal();
  };

  const assertOwned = async () => {
    if (stopped || lost) {
      throw new TaskExecutionOwnershipLostError();
    }

    const owned = await params.repository.isTaskExecutionOwner({
      taskId: params.taskId,
      ownerToken: params.ownerToken,
    });

    if (!owned) {
      markLost();
      throw new TaskExecutionOwnershipLostError();
    }

    scheduleRenewal();
  };

  const stop = async () => {
    stopped = true;
    clearRenewal();
    await renewalInFlight;
  };

  scheduleRenewal();

  return {
    ownerToken: params.ownerToken,
    get expiresAt() {
      return expiresAt;
    },
    assertOwned,
    stop,
  };
}
