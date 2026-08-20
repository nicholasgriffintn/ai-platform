import {
  isPreemptiveInstruction,
  resolveNextInstruction,
  submitThreadInstructionSchema,
  type ThreadCoordinatorState,
  type ThreadInstruction,
  type ThreadInstructionKind,
} from "@ngriffin_uk/polychat-schemas";
import { Agent } from "agents";

import type { IEnv } from "~/types";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

const QUEUE_KEY = "queue";
const STATUS_KEY = "status";
const INDEX_KEY = "queue-index";
const MAX_QUEUE_LENGTH = 100;
// A turn that dies without releasing must not wedge the conversation. The lease
// is longer than any real turn and short enough that a wedged thread heals.
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

/**
 * One coordinator per conversation. Every operation that mutates a
 * conversation's history — turns, goal continuations, compaction, goal
 * lifecycle, title generation — goes through this queue, so they serialise
 * against each other instead of racing. The Durable Object is single-threaded
 * per conversation, which is what makes the ordering real rather than hopeful.
 */
export class ConversationCoordinator extends Agent<IEnv> {
  private get storage(): DurableObjectStorage {
    return this.ctx.storage;
  }

  private async readQueue(): Promise<ThreadInstruction[]> {
    const raw = await this.storage.get<string>(QUEUE_KEY);

    return raw ? (safeParseJson<ThreadInstruction[]>(raw) ?? []) : [];
  }

  private async putQueue(queue: ThreadInstruction[]): Promise<void> {
    await this.storage.put(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_LENGTH)));
  }

  private async getStatus(): Promise<StoredStatus> {
    const raw = await this.storage.get<string>(STATUS_KEY);
    const stored = raw ? (safeParseJson<StoredStatus>(raw) ?? IDLE_STATUS) : IDLE_STATUS;

    return hasExpired(stored, Date.now()) ? IDLE_STATUS : stored;
  }

  private async putStatus(status: StoredStatus): Promise<void> {
    await this.storage.put(STATUS_KEY, JSON.stringify(status));
  }

  private async nextIndex(): Promise<number> {
    const current = (await this.storage.get<number>(INDEX_KEY)) ?? 0;
    const next = current + 1;

    await this.storage.put(INDEX_KEY, next);

    return next;
  }

  private async readState(): Promise<ThreadCoordinatorState> {
    const [queue, status] = await Promise.all([this.readQueue(), this.getStatus()]);

    return {
      status: status.status,
      currentOperation: status.currentOperation,
      queue,
      updatedAt: status.updatedAt,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/state" && request.method === "GET") {
      return Response.json(await this.readState());
    }

    if (pathname === "/instructions" && request.method === "POST") {
      const body = await request.json();
      const parsed = submitThreadInstructionSchema.safeParse(body);

      if (!parsed.success) {
        return Response.json({ error: "Invalid thread instruction" }, { status: 400 });
      }

      const instruction: ThreadInstruction = {
        ...parsed.data,
        id: generateId(),
        index: await this.nextIndex(),
        enqueuedAt: new Date().toISOString(),
      };

      if (isPreemptiveInstruction(instruction.kind)) {
        await this.putQueue([]);
        await this.putStatus({
          status: "idle",
          currentOperation: null,
          updatedAt: instruction.enqueuedAt,
        });

        return Response.json({ instruction, preempted: true });
      }

      const queue = await this.readQueue();

      await this.putQueue([...queue, instruction]);

      return Response.json({ instruction, preempted: false });
    }

    // A synchronous caller wants the thread now or an honest refusal, not a
    // queue slot nobody will drain.
    if (pathname === "/acquire" && request.method === "POST") {
      const body = (await request.json()) as { kind?: unknown };
      const parsed = submitThreadInstructionSchema.safeParse({ kind: body?.kind });

      if (!parsed.success) {
        return Response.json({ error: "Invalid thread instruction" }, { status: 400 });
      }

      const status = await this.getStatus();

      if (status.status === "running") {
        return Response.json({ acquired: false, currentOperation: status.currentOperation });
      }

      const acquiredAt = Date.now();

      await this.putStatus({
        status: "running",
        currentOperation: parsed.data.kind,
        updatedAt: new Date(acquiredAt).toISOString(),
        expiresAt: new Date(acquiredAt + LOCK_LEASE_MS).toISOString(),
      });

      return Response.json({ acquired: true, currentOperation: parsed.data.kind });
    }

    if (pathname === "/claim" && request.method === "POST") {
      const [queue, status] = await Promise.all([this.readQueue(), this.getStatus()]);
      const decision = resolveNextInstruction({ status: status.status, queue });

      if (!decision.next) {
        if (decision.reason === "superseded") {
          await this.putQueue(
            queue.filter((instruction) => instruction.kind !== "goal_continuation"),
          );
        }

        return Response.json({ instruction: null, reason: decision.reason });
      }

      const claimed = decision.next;
      const now = new Date().toISOString();

      await this.putQueue(queue.filter((instruction) => instruction.id !== claimed.id));
      await this.putStatus({
        status: "running",
        currentOperation: claimed.kind,
        updatedAt: now,
        expiresAt: new Date(Date.parse(now) + LOCK_LEASE_MS).toISOString(),
      });

      return Response.json({ instruction: claimed, reason: decision.reason });
    }

    if (pathname === "/release" && request.method === "POST") {
      await this.putStatus({
        status: "idle",
        currentOperation: null,
        updatedAt: new Date().toISOString(),
      });

      return Response.json(await this.readState());
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
