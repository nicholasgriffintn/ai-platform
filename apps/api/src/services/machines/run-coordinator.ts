import {
  machineRunRequestSchema,
  machineRunUpdateSchema,
  type MachineRunRequest,
  type MachineRunSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { Agent } from "agents";

import type { IEnv } from "~/types";

interface StoredRun {
  request: MachineRunRequest;
  snapshot: MachineRunSnapshot;
  token?: string;
  sequence: number;
  expiresAt: number;
  updatedAt: number;
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
        } else if (
          (run.snapshot.state === "running" || run.snapshot.state === "pending") &&
          now - run.updatedAt > CONNECTION_TIMEOUT_MS
        ) {
          run.snapshot.state = "failed";
          run.snapshot.error =
            "The desktop stopped responding. Open Polychat on that machine and try again.";
          await this.ctx.storage.put(key, run);
        }
      }

      if (path === "/claim") {
        await this.ctx.storage.put("connectedAt", now);
        const entry = [...runs.entries()].find(([, run]) => run.snapshot.state === "pending");

        if (!entry) {
          return Response.json(null);
        }

        const [key, run] = entry;

        run.token = crypto.randomUUID();
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

        if (
          [...runs.values()].some(
            (run) => run.snapshot.state === "running" || run.snapshot.state === "pending",
          )
        ) {
          return Response.json(
            { error: "This machine is busy. Wait for its current run to finish." },
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
          snapshot: { id: input.id, state: "pending", text: "" },
          sequence: -1,
          expiresAt: now + RETENTION_MS,
          updatedAt: now,
        };

        await this.ctx.storage.put(`run:${input.id}`, run);
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

        if (run.snapshot.text.length + input.text.length > 1_000_000) {
          run.snapshot.state = "failed";
          run.snapshot.error = "The model exceeded the response limit.";
        } else {
          run.snapshot.text += input.text;
          run.snapshot.state = input.state;
          run.snapshot.error = input.error;
        }

        run.sequence = input.sequence;
        run.updatedAt = now;
        await this.ctx.storage.put("connectedAt", now);
        await this.ctx.storage.put(`run:${input.id}`, run);

        return Response.json(run.snapshot);
      }

      const id = path.split("/")[2];
      const run = runs.get(`run:${id}`);

      if (!run) {
        return Response.json({ error: "Run unavailable or expired" }, { status: 404 });
      }

      if (
        path.startsWith("/cancel/") &&
        (run.snapshot.state === "pending" || run.snapshot.state === "running")
      ) {
        run.snapshot.state = "cancelled";
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
