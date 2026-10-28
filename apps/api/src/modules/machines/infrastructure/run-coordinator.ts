import {
  MACHINE_MAX_ACTIVE_RUNS,
  machineRunDecideSchema,
  machineRunRequestSchema,
  machineRunUpdateSchema,
  type AgentHarnessEventRecord,
  type MachineRunDecision,
  type MachineRunEvents,
  type MachineRunRequest,
  type MachineRunSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { Agent } from "agents";

import {
  appendRunRecords,
  isAgentRunRequest,
  MAX_MACHINE_RUN_RECORDS,
  recordsAfter,
  settlementEvent,
} from "~/modules/machines/domain/run-events";
import type { IEnv } from "~/types";

interface StoredRun {
  request: MachineRunRequest;
  snapshot: MachineRunSnapshot;
  token?: string;
  sequence: number;
  expiresAt: number;
  updatedAt: number;
  records?: AgentHarnessEventRecord[];
  decisions?: MachineRunDecision[];
}

function settle(run: StoredRun): void {
  const event = isAgentRunRequest(run.request)
    ? settlementEvent(run.snapshot.id, run.snapshot)
    : null;

  if (event) {
    run.records = appendRunRecords(run.records ?? [], [event]);
  }
}

function isOpen(run: StoredRun): boolean {
  return run.snapshot.state === "pending" || run.snapshot.state === "running";
}

function cancel(run: StoredRun): void {
  run.snapshot.state = "cancelled";
  settle(run);
}

const RETENTION_MS = 10 * 60_000;
const CONNECTION_TIMEOUT_MS = 30_000;

export class MachineRunCoordinator extends Agent<IEnv> {
  async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const path = new URL(request.url).pathname;
      const now = Date.now();
      const runs = await this.ctx.storage.list<StoredRun>({ prefix: "run:" });

      for (const [key, run] of runs) {
        if (run.expiresAt <= now) {
          await this.ctx.storage.delete(key);
          runs.delete(key);
        } else if (isOpen(run) && now - run.updatedAt > CONNECTION_TIMEOUT_MS) {
          run.snapshot.state = "failed";
          run.snapshot.error =
            "The desktop stopped responding. Open Polychat on that machine and try again.";
          settle(run);
          await this.ctx.storage.put(key, run);
        }
      }

      if (path === "/capacity") {
        const active = [...runs.values()].filter(isOpen).length;

        return Response.json({ active, available: Math.max(0, MACHINE_MAX_ACTIVE_RUNS - active) });
      }

      if (path === "/claim") {
        await this.ctx.storage.put("connectedAt", now);
        const entry = [...runs.entries()].find(([, run]) => run.snapshot.state === "pending");

        if (!entry) {
          return Response.json(null);
        }

        const [key, run] = entry;

        run.token = generateId();
        run.snapshot.state = "running";
        run.updatedAt = now;
        await this.ctx.storage.put(key, run);

        return Response.json({ request: run.request, token: run.token });
      }

      if (path === "/create") {
        const input = machineRunRequestSchema.parse(await request.json());
        const existing = runs.get(`run:${input.id}`);

        if (existing) {
          if (JSON.stringify(existing.request) !== JSON.stringify(input)) {
            return Response.json({ error: "Run identifier already used" }, { status: 409 });
          }

          return Response.json(existing.snapshot);
        }

        const connectedAt = await this.ctx.storage.get<number>("connectedAt");

        if (!connectedAt || now - connectedAt > CONNECTION_TIMEOUT_MS) {
          return Response.json(
            { error: "The desktop is not connected for model execution." },
            { status: 409 },
          );
        }

        const supersededId = isAgentRunRequest(input)
          ? await this.ctx.storage.get<string>(`conversation:${input.conversationId}`)
          : undefined;
        const superseded = supersededId ? runs.get(`run:${supersededId}`) : undefined;

        if (superseded && isOpen(superseded)) {
          cancel(superseded);
          await this.ctx.storage.put(`run:${superseded.snapshot.id}`, superseded);
        }

        const active = [...runs.values()].filter(isOpen);

        if (active.length >= MACHINE_MAX_ACTIVE_RUNS) {
          return Response.json(
            {
              error: `This machine is already running ${MACHINE_MAX_ACTIVE_RUNS} jobs. Try again when one finishes.`,
            },
            { status: 409 },
          );
        }

        if (runs.size >= 20) {
          const oldest = [...runs.entries()].sort(
            (left, right) => left[1].expiresAt - right[1].expiresAt,
          )[0];

          if (oldest) {
            await this.ctx.storage.delete(oldest[0]);
          }
        }

        const run: StoredRun = {
          request: input,
          snapshot: { id: input.id, state: "pending", text: "", decisions: [] },
          sequence: -1,
          expiresAt: now + RETENTION_MS,
          updatedAt: now,
          records: [],
          decisions: [],
        };

        await this.ctx.storage.put(`run:${input.id}`, run);

        if (isAgentRunRequest(input)) {
          await this.ctx.storage.put(`conversation:${input.conversationId}`, input.id);
        }

        await this.ctx.storage.setAlarm(now + RETENTION_MS);

        return Response.json(run.snapshot);
      }

      if (path === "/update") {
        const input = machineRunUpdateSchema.parse(await request.json());
        const run = runs.get(`run:${input.id}`);

        if (!run || !run.token || run.token !== input.token) {
          return Response.json({ error: "Run unavailable" }, { status: 404 });
        }

        if (run.snapshot.state !== "running" || input.sequence <= run.sequence) {
          return Response.json(run.snapshot);
        }

        if (input.sequence !== run.sequence + 1) {
          return Response.json({ error: "Out-of-order model output" }, { status: 409 });
        }

        const records = appendRunRecords(run.records ?? [], input.events);

        if (
          run.snapshot.text.length + input.text.length > 1_000_000 ||
          records.length > MAX_MACHINE_RUN_RECORDS
        ) {
          run.snapshot.state = "failed";
          run.snapshot.error = "The model exceeded the response limit.";
        } else {
          run.snapshot.text += input.text;
          run.records = records;
          run.snapshot.state = input.state;
          run.snapshot.error = input.error;
        }

        if (run.snapshot.state !== "running") {
          settle(run);
        }

        const decisions = run.decisions ?? [];

        run.decisions = [];
        run.sequence = input.sequence;
        run.updatedAt = now;
        run.expiresAt = now + RETENTION_MS;
        await this.ctx.storage.put("connectedAt", now);
        await this.ctx.storage.put(`run:${input.id}`, run);

        return Response.json({ ...run.snapshot, decisions });
      }

      if (path.startsWith("/events/") || path === "/decide") {
        const decide =
          path === "/decide" ? machineRunDecideSchema.parse(await request.json()) : null;
        const [, , conversationId = "", after = "0"] = path.split("/");
        const runId = await this.ctx.storage.get<string>(
          `conversation:${decide?.conversationId ?? decodeURIComponent(conversationId)}`,
        );
        const run = runId ? runs.get(`run:${runId}`) : undefined;

        if (!run) {
          return Response.json({ error: "No agent run for this conversation" }, { status: 404 });
        }

        if (decide) {
          const open = isOpen(run);

          if (open) {
            run.decisions = [
              ...(run.decisions ?? []),
              { approvalId: decide.approvalId, approved: decide.approved },
            ];
            run.expiresAt = now + RETENTION_MS;
            await this.ctx.storage.put(`run:${run.snapshot.id}`, run);
          }

          return Response.json({ applied: open });
        }

        return Response.json({
          id: run.snapshot.id,
          state: run.snapshot.state,
          records: recordsAfter(run.records ?? [], Number.parseInt(after, 10) || 0),
        } satisfies MachineRunEvents);
      }

      const id = path.split("/")[2];
      const run = runs.get(`run:${id}`);

      if (!run) {
        return Response.json({ error: "Run unavailable or expired" }, { status: 404 });
      }

      if (path.startsWith("/cancel/") && isOpen(run)) {
        cancel(run);
        await this.ctx.storage.put(`run:${id}`, run);
      }

      return Response.json(run.snapshot);
    });
  }

  async alarm(): Promise<void> {
    const runs = await this.ctx.storage.list<StoredRun>({ prefix: "run:" });
    let next = Infinity;

    for (const [key, run] of runs) {
      if (run.expiresAt <= Date.now()) {
        await this.ctx.storage.delete(key);
      } else {
        next = Math.min(next, run.expiresAt);
      }
    }

    if (Number.isFinite(next)) {
      await this.ctx.storage.setAlarm(next);
    }
  }
}
