import {
  THREAD_LEASE_DURATION_MS,
  threadLeaseAcquireRequestSchema,
  threadLeaseOwnerRequestSchema,
  type ThreadOperation,
} from "@ngriffin_uk/polychat-schemas";
import { Agent } from "agents";

import type { IEnv } from "~/types";
import { safeParseJson } from "~/utils/json";

const STATUS_KEY = "status";
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
  private get storage(): DurableObjectStorage {
    return this.ctx.storage;
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
