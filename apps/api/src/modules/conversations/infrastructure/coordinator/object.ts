import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  THREAD_LEASE_DURATION_MS,
  threadEffectsDrainRequestSchema,
  threadLeaseAcquireRequestSchema,
  threadLeaseOwnerRequestSchema,
  type ThreadOperation,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { Agent } from "agents";

import {
  drainRunEffects,
  type RunEffectDrainResult,
} from "~/modules/responses/application/runs/effects";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "services/conversations/coordinator/object" });

const STATUS_KEY = "status";
const EFFECTS_CONVERSATION_KEY = "effects_conversation_id";
const EFFECTS_FAILURE_RETRY_MS = 5_000;

interface StoredStatus {
  status: "idle" | "running";
  currentOperation: ThreadOperation | null;
  updatedAt: string;
  expiresAt?: string;
  ownerToken?: string;
}

function hasExpired(status: StoredStatus, now: number): boolean {
  const expiresAt = status.expiresAt ? Date.parse(status.expiresAt) : Number.NaN;

  return (
    status.status === "running" &&
    (!status.ownerToken || !Number.isFinite(expiresAt) || expiresAt <= now)
  );
}

const IDLE_STATUS: StoredStatus = {
  status: "idle",
  currentOperation: null,
  updatedAt: new Date(0).toISOString(),
};

export class ConversationCoordinator extends Agent<IEnv> {
  private effectsDrain: Promise<unknown> = Promise.resolve();

  private get storage(): DurableObjectStorage {
    return this.ctx.storage;
  }

  private async scheduleEffectsAlarm(at: number): Promise<void> {
    const scheduled = await this.storage.getAlarm();

    if (scheduled === null || scheduled > at) {
      await this.storage.setAlarm(Math.max(at, Date.now()));
    }
  }

  private drainEffects(conversationId: string): Promise<RunEffectDrainResult> {
    const drain = this.effectsDrain.then(async () => {
      try {
        const status = await this.getStatus();
        const result = await drainRunEffects({
          env: this.env,
          conversationId,
          liveOwnerToken: status.status === "running" ? (status.ownerToken ?? null) : null,
        });

        if (result.nextDrainAt) {
          await this.scheduleEffectsAlarm(Date.parse(result.nextDrainAt));
        }

        return result;
      } catch (error) {
        await this.scheduleEffectsAlarm(Date.now() + EFFECTS_FAILURE_RETRY_MS);
        throw error;
      }
    });

    this.effectsDrain = drain.catch(() => undefined);

    return drain;
  }

  private async bindEffectsConversation(conversationId: string): Promise<boolean> {
    const bound = await this.storage.get<string>(EFFECTS_CONVERSATION_KEY);

    if (bound) {
      return bound === conversationId;
    }

    await this.storage.put(EFFECTS_CONVERSATION_KEY, conversationId);

    return true;
  }

  async alarm(): Promise<void> {
    try {
      await super.alarm();
    } finally {
      const conversationId = await this.storage.get<string>(EFFECTS_CONVERSATION_KEY);

      if (conversationId) {
        await this.drainEffects(conversationId);
      }
    }
  }

  private async getStatus(): Promise<StoredStatus> {
    const raw = await this.storage.get<string>(STATUS_KEY);
    const stored = raw ? (safeParseJson<StoredStatus>(raw) ?? IDLE_STATUS) : IDLE_STATUS;

    return hasExpired(stored, Date.now()) ? IDLE_STATUS : stored;
  }

  private async putStatus(status: StoredStatus): Promise<void> {
    await this.storage.put(STATUS_KEY, JSON.stringify(status));
  }

  private publicStatus(status: StoredStatus): Omit<StoredStatus, "ownerToken"> {
    const { ownerToken: _ownerToken, ...publicStatus } = status;

    return publicStatus;
  }

  private extendLease(status: StoredStatus, now: number): StoredStatus {
    return {
      ...status,
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + THREAD_LEASE_DURATION_MS).toISOString(),
    };
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/status" && request.method === "POST") {
      return Response.json(this.publicStatus(await this.getStatus()));
    }

    if (pathname === "/effects/drain" && request.method === "POST") {
      const parsed = threadEffectsDrainRequestSchema.safeParse(
        await request.json().catch(() => null),
      );

      if (!parsed.success || !(await this.bindEffectsConversation(parsed.data.conversationId))) {
        return Response.json({ error: "Invalid effects drain request" }, { status: 400 });
      }

      try {
        return Response.json(await this.drainEffects(parsed.data.conversationId));
      } catch (error) {
        logger.error("Run effects drain failed", {
          conversationId: parsed.data.conversationId,
          error: getErrorMessage(error),
        });

        return Response.json({ error: "Run effects drain failed" }, { status: 503 });
      }
    }

    if (pathname === "/acquire" && request.method === "POST") {
      const parsed = threadLeaseAcquireRequestSchema.safeParse(
        await request.json().catch(() => null),
      );

      if (!parsed.success) {
        return Response.json({ error: "Invalid thread lease request" }, { status: 400 });
      }

      return Response.json(
        await this.ctx.blockConcurrencyWhile(async () => {
          const status = await this.getStatus();

          if (status.status === "running") {
            return { acquired: false, currentOperation: status.currentOperation };
          }

          const acquired = this.extendLease(
            {
              status: "running",
              currentOperation: parsed.data.kind,
              updatedAt: new Date(0).toISOString(),
              ownerToken: parsed.data.ownerToken,
            },
            Date.now(),
          );

          await this.putStatus(acquired);

          return {
            acquired: true,
            currentOperation: acquired.currentOperation,
            expiresAt: acquired.expiresAt,
          };
        }),
      );
    }

    if (
      (pathname === "/renew" || pathname === "/assert" || pathname === "/release") &&
      request.method === "POST"
    ) {
      const parsed = threadLeaseOwnerRequestSchema.safeParse(
        await request.json().catch(() => null),
      );

      if (!parsed.success) {
        return Response.json({ error: "Invalid thread lease owner" }, { status: 400 });
      }

      return Response.json(
        await this.ctx.blockConcurrencyWhile(async () => {
          const status = await this.getStatus();

          if (status.status !== "running" || status.ownerToken !== parsed.data.ownerToken) {
            if (pathname === "/renew") {
              return { renewed: false };
            }

            if (pathname === "/assert") {
              return { owned: false };
            }

            return { released: false };
          }

          if (pathname === "/release") {
            await this.putStatus({
              status: "idle",
              currentOperation: null,
              updatedAt: new Date().toISOString(),
            });

            return { released: true };
          }

          const renewed = this.extendLease(status, Date.now());

          await this.putStatus(renewed);

          return pathname === "/renew"
            ? { renewed: true, expiresAt: renewed.expiresAt }
            : { owned: true, expiresAt: renewed.expiresAt };
        }),
      );
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
