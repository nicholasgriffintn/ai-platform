import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ConversationRunEffectRow } from "~/infrastructure/database/schema";
import {
  PROCESS_BOUND_REFUSED_REASON,
  type ProcessBoundRunEffectKind,
  type ReplaySafeRunEffectKind,
} from "~/modules/conversations/domain/run-effects";
import type { ConversationWriteFence } from "~/modules/conversations/domain/write-fence";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { RunEffectRepository } from "~/modules/conversations/infrastructure/RunEffectRepository";
import { cancelDelegationTree } from "~/modules/delegations/application/cancel-tree";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

import { cleanupCancelledChatRun } from "./cancellation-cleanup";
import { releaseQueuedFollowUpWhenIdle } from "./follow-up-queue";

const logger = getLogger({ prefix: "services/chat-runs/effects" });

const MAX_EFFECTS_PER_DRAIN = 20;

type ReplaySafeEffectHandler = (
  context: ServiceContext,
  effect: ConversationRunEffectRow,
) => Promise<void>;

const REPLAY_SAFE_HANDLERS: Record<ReplaySafeRunEffectKind, ReplaySafeEffectHandler> = {
  cancel_cleanup: async (context, effect) => {
    const run = await context.repositories.get(ConversationRunRepository).getById(effect.run_id);

    if (!run) {
      return;
    }

    await cleanupCancelledChatRun(context, { ...run, attempt: effect.run_attempt });
    await cancelDelegationTree(context, run.id);
  },
  release_follow_up: async (context, effect) => {
    await releaseQueuedFollowUpWhenIdle(context, effect.conversation_id);
  },
};

function isReplaySafe(kind: ConversationRunEffectRow["kind"]): kind is ReplaySafeRunEffectKind {
  return kind in REPLAY_SAFE_HANDLERS;
}

async function executeReplaySafeEffect(env: IEnv, effect: ConversationRunEffectRow) {
  if (!isReplaySafe(effect.kind)) {
    throw new AssistantError(
      `Run effect ${effect.kind} cannot be replayed`,
      ErrorType.INTERNAL_ERROR,
    );
  }

  const user = effect.actor_user_id
    ? await new UserRepository(env).getUserById(effect.actor_user_id)
    : null;
  const pending: Promise<unknown>[] = [];
  const context = createServiceContext({
    env,
    user,
    waitUntil: (work) => {
      pending.push(work);
    },
  });

  try {
    await REPLAY_SAFE_HANDLERS[effect.kind](context, effect);
  } finally {
    await Promise.allSettled(pending);
  }
}

export interface RunEffectDrainResult {
  executed: number;
  nextAvailableAt: string | null;
}

export async function drainRunEffects(params: {
  env: IEnv;
  conversationId: string;
  liveOwnerToken: string | null;
  now?: () => Date;
  execute?: (env: IEnv, effect: ConversationRunEffectRow) => Promise<void>;
}): Promise<RunEffectDrainResult> {
  const now = params.now ?? (() => new Date());
  const execute = params.execute ?? executeReplaySafeEffect;
  const repository = new RunEffectRepository(params.env);
  const recovered = await repository.recoverAbandoned({
    conversationId: params.conversationId,
    liveOwnerToken: params.liveOwnerToken,
    now: now(),
  });

  for (const effect of recovered.cancelled) {
    logger.warn("Cancelled a run effect whose session ended", {
      effectId: effect.id,
      runId: effect.run_id,
      kind: effect.kind,
    });
  }

  const leaseOwner = `drain_${generateId()}`;
  let executed = 0;

  while (executed < MAX_EFFECTS_PER_DRAIN) {
    const effect = await repository.claimNextReplaySafe({
      conversationId: params.conversationId,
      leaseOwner,
      now: now(),
    });

    if (!effect) {
      break;
    }

    executed += 1;

    try {
      await execute(params.env, effect);
      await repository.succeed(effect, leaseOwner, now());
    } catch (error) {
      const settled = await repository.retryOrFail(
        effect,
        leaseOwner,
        getErrorMessage(error),
        now(),
      );

      logger.warn("Run effect failed", {
        effectId: effect.id,
        runId: effect.run_id,
        kind: effect.kind,
        attempt: effect.attempt_count,
        status: settled?.status,
        error: getErrorMessage(error),
      });

      break;
    }
  }

  return { executed, nextAvailableAt: await repository.nextAvailableAt(params.conversationId) };
}

export interface ProcessBoundEffectClaim {
  succeed(): Promise<void>;
  fail(error: unknown): Promise<void>;
}

function processBoundRefusedError(): AssistantError {
  return new AssistantError(PROCESS_BOUND_REFUSED_REASON, ErrorType.CONFLICT_ERROR, 409, {
    reason: "process_bound_effect_refused",
  });
}

export async function claimProcessBoundRunEffect(params: {
  repository: RunEffectRepository;
  fence: ConversationWriteFence & { readonly ownerToken: string };
  runId: string;
  runAttempt: number;
  kind: ProcessBoundRunEffectKind;
  now?: () => Date;
}): Promise<ProcessBoundEffectClaim> {
  const now = params.now ?? (() => new Date());
  const target = {
    runId: params.runId,
    runAttempt: params.runAttempt,
    kind: params.kind,
    ownerToken: params.fence.ownerToken,
  };

  try {
    await params.fence.assertOwned();
  } catch (error) {
    await params.repository.refuseProcessBound({ ...target, now: now() });
    throw error;
  }

  const effect = await params.repository.claimProcessBound({ ...target, now: now() });

  if (!effect) {
    await params.repository.refuseProcessBound({ ...target, now: now() });
    throw processBoundRefusedError();
  }

  const settle = async (outcome: "succeeded" | "failed", error?: unknown) => {
    try {
      await params.repository.settleProcessBound({
        id: effect.id,
        ownerToken: params.fence.ownerToken,
        outcome,
        ...(error === undefined ? {} : { error: getErrorMessage(error) }),
        now: now(),
      });
    } catch (settleError) {
      logger.error("Could not settle a process-bound run effect", {
        effectId: effect.id,
        outcome,
        error: getErrorMessage(settleError),
      });
    }
  };

  return {
    succeed: () => settle("succeeded"),
    fail: (error) => settle("failed", error),
  };
}
