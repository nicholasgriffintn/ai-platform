import {
  THREAD_LEASE_RENEWAL_INTERVAL_MS,
  threadLeaseAcquisitionSchema,
  threadLeaseOwnershipSchema,
  threadLeaseReleaseSchema,
  threadLeaseRenewalSchema,
  threadStatusSchema,
  type ThreadOperation,
} from "@ngriffin_uk/polychat-schemas";

import type { ConversationWriteFence } from "~/lib/conversation/write-fence";
import { getDurableObjectStub, postDurableObjectJson } from "~/lib/durable-objects/client";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/conversations/coordinator/client" });
const COORDINATOR_ORIGIN = "https://conversation-coordinator";

type CoordinatorOutcome<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" }
  | { status: "failed" };

async function callCoordinator<T>(
  env: IEnv | undefined,
  conversationId: string,
  path: string,
  body?: unknown,
): Promise<CoordinatorOutcome<T>> {
  const stub = getDurableObjectStub(env?.CONVERSATION_COORDINATOR, conversationId);

  if (!stub) {
    return { status: "unavailable" };
  }

  try {
    const response = await postDurableObjectJson(stub, `${COORDINATOR_ORIGIN}${path}`, body);

    if (!response.ok) {
      logger.error("Conversation coordinator refused a call", {
        conversationId,
        path,
        status: response.status,
      });

      return { status: "failed" };
    }

    return { status: "ok", data: (await response.json()) as T };
  } catch (error) {
    logger.error("Conversation coordinator call failed", { error, path, conversationId });

    return { status: "failed" };
  }
}

export interface ThreadLease extends ConversationWriteFence {
  readonly conversationId: string;
  readonly kind: ThreadOperation;
  readonly ownerToken: string;
  readonly expiresAt: string;
  release(): Promise<void>;
}

export interface ThreadLockRequest {
  env: IEnv | undefined;
  conversationId: string;
  kind: ThreadOperation;
}

export type ThreadLockFailure = {
  acquired: false;
  currentOperation: ThreadOperation | null;
  reason: "busy" | "unavailable";
};

export type ThreadLockAcquisition = { acquired: true; lease: ThreadLease } | ThreadLockFailure;

function leaseOwnershipLostError(): AssistantError {
  return new AssistantError(
    "This conversation is now owned by another operation. The stale attempt cannot save changes.",
    ErrorType.CONFLICT_ERROR,
    409,
    { reason: "lease_ownership_lost" },
  );
}

export function isThreadLeaseOwnershipLostError(error: unknown): boolean {
  return error instanceof AssistantError && error.context?.reason === "lease_ownership_lost";
}

function createThreadLease(
  request: ThreadLockRequest,
  ownerToken: string,
  initialExpiresAt: string,
): ThreadLease {
  let expiresAt = initialExpiresAt;
  let lost = false;
  let released = false;
  let renewalTimer: ReturnType<typeof setTimeout> | undefined;
  let renewalInFlight: Promise<void> | undefined;

  const stopRenewal = () => {
    if (renewalTimer !== undefined) {
      clearTimeout(renewalTimer);
      renewalTimer = undefined;
    }
  };

  const markLost = () => {
    lost = true;
    stopRenewal();
  };

  const renew = async () => {
    if (released || lost) {
      return;
    }

    const outcome = await callCoordinator<unknown>(request.env, request.conversationId, "/renew", {
      ownerToken,
    });
    const parsed =
      outcome.status === "ok" ? threadLeaseRenewalSchema.safeParse(outcome.data) : null;

    if (!parsed?.success || !parsed.data.renewed) {
      markLost();

      return;
    }

    expiresAt = parsed.data.expiresAt;

    if (!released) {
      scheduleRenewal();
    }
  };

  const scheduleRenewal = () => {
    stopRenewal();

    renewalTimer = setTimeout(() => {
      renewalTimer = undefined;
      renewalInFlight = renew().finally(() => {
        renewalInFlight = undefined;
      });
    }, THREAD_LEASE_RENEWAL_INTERVAL_MS);
  };

  const assertOwned = async () => {
    if (released || lost) {
      throw leaseOwnershipLostError();
    }

    const outcome = await callCoordinator<unknown>(request.env, request.conversationId, "/assert", {
      ownerToken,
    });
    const parsed =
      outcome.status === "ok" ? threadLeaseOwnershipSchema.safeParse(outcome.data) : null;

    if (!parsed?.success || !parsed.data.owned) {
      markLost();
      throw leaseOwnershipLostError();
    }

    expiresAt = parsed.data.expiresAt;
    scheduleRenewal();
  };

  const release = async () => {
    if (released) {
      return;
    }

    released = true;
    stopRenewal();
    await renewalInFlight;

    const outcome = await callCoordinator<unknown>(
      request.env,
      request.conversationId,
      "/release",
      { ownerToken },
    );
    const parsed =
      outcome.status === "ok" ? threadLeaseReleaseSchema.safeParse(outcome.data) : null;

    if (!parsed?.success) {
      logger.error("Conversation lease release could not be confirmed", {
        conversationId: request.conversationId,
        kind: request.kind,
      });
    }
  };

  scheduleRenewal();

  return {
    conversationId: request.conversationId,
    kind: request.kind,
    ownerToken,
    get expiresAt() {
      return expiresAt;
    },
    assertOwned,
    release,
  };
}

export async function acquireThread(params: ThreadLockRequest): Promise<ThreadLockAcquisition> {
  const ownerToken = generateId();
  const outcome = await callCoordinator<unknown>(params.env, params.conversationId, "/acquire", {
    kind: params.kind,
    ownerToken,
  });
  const parsed =
    outcome.status === "ok" ? threadLeaseAcquisitionSchema.safeParse(outcome.data) : null;

  if (!parsed?.success) {
    return {
      acquired: false,
      currentOperation: null,
      reason: "unavailable",
    };
  }

  if (!parsed.data.acquired) {
    return {
      acquired: false,
      currentOperation: parsed.data.currentOperation,
      reason: "busy",
    };
  }

  return {
    acquired: true,
    lease: createThreadLease(params, ownerToken, parsed.data.expiresAt),
  };
}

export async function getActiveThreadOperation(params: {
  env: IEnv | undefined;
  conversationId: string;
}): Promise<ThreadOperation | null | undefined> {
  const outcome = await callCoordinator<unknown>(params.env, params.conversationId, "/status");

  if (outcome.status === "unavailable") {
    return undefined;
  }

  const parsed = outcome.status === "ok" ? threadStatusSchema.safeParse(outcome.data) : null;

  if (!parsed?.success) {
    throw new AssistantError(
      "Conversation status is temporarily unavailable",
      ErrorType.EXTERNAL_API_ERROR,
    );
  }

  return parsed.data.status === "running" ? parsed.data.currentOperation : null;
}

export function threadBusyError(currentOperation?: ThreadOperation | null): AssistantError {
  return new AssistantError(
    currentOperation
      ? `This conversation is already working on something (${currentOperation}). Try again once it finishes.`
      : "This conversation is already working on something. Try again once it finishes.",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

export function threadLockError(failure: ThreadLockFailure): AssistantError {
  if (failure.reason === "unavailable") {
    return new AssistantError(
      "Conversation coordination is temporarily unavailable. Try again shortly.",
      ErrorType.EXTERNAL_API_ERROR,
      503,
    );
  }

  return threadBusyError(failure.currentOperation);
}

export async function withThreadLock<T>(
  params: ThreadLockRequest,
  run: (lease: ThreadLease) => Promise<T>,
): Promise<T> {
  const lock = await acquireThread(params);

  if (lock.acquired === false) {
    throw threadLockError(lock);
  }

  try {
    await lock.lease.assertOwned();

    return await run(lock.lease);
  } finally {
    await lock.lease.release();
  }
}

export async function withThreadLockIfFree<T>(
  params: ThreadLockRequest,
  run: (lease: ThreadLease) => Promise<T>,
): Promise<T | null> {
  const lock = await acquireThread(params);

  if (lock.acquired === false) {
    return null;
  }

  try {
    await lock.lease.assertOwned();

    return await run(lock.lease);
  } finally {
    await lock.lease.release();
  }
}
