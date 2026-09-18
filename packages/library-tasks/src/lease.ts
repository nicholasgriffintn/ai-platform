import { TaskError } from "./errors.js";

export const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1000;
export const DEFAULT_LEASE_RENEWAL_INTERVAL_MS = 60 * 1000;

export interface LeaseStore {
  renew(params: { taskId: string; ownerToken: string; expiresAt: string }): Promise<string | null>;
  isOwner(params: { taskId: string; ownerToken: string }): Promise<boolean>;
}

export interface ExecutionLease {
  readonly ownerToken: string;
  readonly expiresAt: string;
  assertOwned(): Promise<void>;
  stop(): Promise<void>;
}

export interface CreateExecutionLeaseOptions {
  store: LeaseStore;
  taskId: string;
  ownerToken: string;
  initialExpiresAt: string;
  durationMs?: number;
  renewalIntervalMs?: number;
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => () => void;
}

export function leaseExpiry(now = Date.now(), durationMs = DEFAULT_LEASE_DURATION_MS): string {
  return new Date(now + durationMs).toISOString();
}

export function leaseRetryDelaySeconds(expiresAt: string, now = Date.now()): number {
  return Math.max(1, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

export function leaseBusyError(taskId: string, expiresAt: string): TaskError {
  return new TaskError("lease_busy", `Task ${taskId} is already running`, { taskId, expiresAt });
}

export function ownershipLostError(taskId: string): TaskError {
  return new TaskError("ownership_lost", `Task ${taskId} is no longer owned by this execution`, {
    taskId,
  });
}

function defaultSchedule(callback: () => void, delayMs: number): () => void {
  const timer = setTimeout(callback, delayMs);

  return () => clearTimeout(timer);
}

export function createExecutionLease(options: CreateExecutionLeaseOptions): ExecutionLease {
  const durationMs = options.durationMs ?? DEFAULT_LEASE_DURATION_MS;
  const renewalIntervalMs = options.renewalIntervalMs ?? DEFAULT_LEASE_RENEWAL_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const schedule = options.schedule ?? defaultSchedule;
  let expiresAt = options.initialExpiresAt;
  let lost = false;
  let stopped = false;
  let cancelRenewal: (() => void) | undefined;
  let renewalInFlight: Promise<void> | undefined;

  const clearRenewal = () => {
    cancelRenewal?.();
    cancelRenewal = undefined;
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

    cancelRenewal = schedule(() => {
      cancelRenewal = undefined;
      renewalInFlight = renew().finally(() => {
        renewalInFlight = undefined;
      });
    }, renewalIntervalMs);
  };

  const renew = async () => {
    if (stopped || lost) {
      return;
    }

    const renewed = await options.store.renew({
      taskId: options.taskId,
      ownerToken: options.ownerToken,
      expiresAt: leaseExpiry(now(), durationMs),
    });

    if (!renewed) {
      markLost();

      return;
    }

    expiresAt = renewed;
    scheduleRenewal();
  };

  scheduleRenewal();

  return {
    ownerToken: options.ownerToken,
    get expiresAt() {
      return expiresAt;
    },
    assertOwned: async () => {
      if (stopped || lost) {
        throw ownershipLostError(options.taskId);
      }

      const owned = await options.store.isOwner({
        taskId: options.taskId,
        ownerToken: options.ownerToken,
      });

      if (!owned) {
        markLost();
        throw ownershipLostError(options.taskId);
      }

      scheduleRenewal();
    },
    stop: async () => {
      stopped = true;
      clearRenewal();
      await renewalInFlight;
    },
  };
}
