import {
  threadInstructionKindSchema,
  type ThreadInstructionKind,
} from "@ngriffin_uk/polychat-schemas";
import { Agent } from "agents";

import type { IEnv } from "~/types";
import { safeParseJson } from "~/utils/json";

const STATUS_KEY = "status";
const LOCK_LEASE_MS = 5 * 60 * 1000;

interface StoredStatus {
  status: "idle" | "running";
  currentOperation: ThreadInstructionKind | null;
  updatedAt: string;
  expiresAt?: string;
}

function hasExpired(status: StoredStatus, now: number): boolean {
  if (status.status !== "running" || !status.expiresAt) {
    return false;
  }

  return Date.parse(status.expiresAt) <= now;
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

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/acquire" && request.method === "POST") {
      const body = (await request.json()) as { kind?: unknown };
      const parsed = threadInstructionKindSchema.safeParse(body?.kind);

      if (!parsed.success) {
        return Response.json({ error: "Invalid thread operation" }, { status: 400 });
      }

      return Response.json(
        await this.ctx.blockConcurrencyWhile(async () => {
          const status = await this.getStatus();

          if (status.status === "running") {
            return { acquired: false, currentOperation: status.currentOperation };
          }

          const acquiredAt = Date.now();

          await this.putStatus({
            status: "running",
            currentOperation: parsed.data,
            updatedAt: new Date(acquiredAt).toISOString(),
            expiresAt: new Date(acquiredAt + LOCK_LEASE_MS).toISOString(),
          });

          return { acquired: true, currentOperation: parsed.data };
        }),
      );
    }

    if (pathname === "/release" && request.method === "POST") {
      const released: StoredStatus = {
        status: "idle",
        currentOperation: null,
        updatedAt: new Date().toISOString(),
      };

      await this.putStatus(released);

      return Response.json(released);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
