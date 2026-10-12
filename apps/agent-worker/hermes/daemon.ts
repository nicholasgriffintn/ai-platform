import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import {
  inputText,
  type AdapterContext,
  type ContainerAdapter,
  type ContainerOutcome,
} from "agents/harness/container/daemon";
import { serveFromEnv } from "agents/harness/container/runtime";
import { z } from "zod";

const HERMES_URL = "http://127.0.0.1:8642";
const API_SERVER_KEY = randomUUID();
const HEALTH_ATTEMPTS = 240;
const RUN_POLL_MS = 1_000;
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "interrupted"]);

const hermesEventSchema = z.object({
  event: z.string(),
  tool: z.string().optional(),
  request_id: z.string().optional(),
  error: z.boolean().optional(),
  output: z.string().optional(),
});
const runStartedSchema = z.object({ run_id: z.string().min(1) });
const runSnapshotSchema = z.object({
  status: z.string(),
  output: z.string().nullish(),
  error: z.string().nullish(),
});

let gateway: Promise<void> | undefined;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hermes(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${HERMES_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_SERVER_KEY}`,
      "Content-Type": "application/json",
    },
  });
}

async function waitForHealth(): Promise<void> {
  for (let attempt = 0; attempt < HEALTH_ATTEMPTS; attempt += 1) {
    const healthy = await fetch(`${HERMES_URL}/health`)
      .then((response) => response.ok)
      .catch(() => false);

    if (healthy) {
      return;
    }

    await delay(500);
  }

  throw new Error("Hermes did not become healthy");
}

function startGateway(): Promise<void> {
  gateway ??= (async () => {
    const child = spawn("/opt/daemon/start-hermes.sh", {
      env: { ...process.env, API_SERVER_KEY },
      stdio: "inherit",
    });

    child.on("exit", () => {
      gateway = undefined;
    });
    await waitForHealth();
  })();

  return gateway;
}

async function followToolEvents(
  runId: string,
  context: AdapterContext,
  signal: AbortSignal,
): Promise<void> {
  const response = await hermes(`/v1/runs/${runId}/events`, { signal });

  if (!response.ok || !response.body) {
    return;
  }

  const decoder = new TextDecoder();
  const running = new Map<string, string[]>();
  let buffer = "";

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const blocks = buffer.split("\n\n");

    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");

      if (!data) {
        continue;
      }

      const event = hermesEventSchema.safeParse(JSON.parse(data));

      if (!event.success) {
        continue;
      }

      const name = event.data.event;
      const tool = event.data.tool ?? "tool";

      if (name === "tool.started") {
        const toolCallId = randomUUID();

        running.set(tool, [...(running.get(tool) ?? []), toolCallId]);
        context.emit({
          type: "message",
          message: {
            id: toolCallId,
            role: "assistant",
            parts: [{ type: "tool", toolCallId, toolName: tool, input: null, state: "running" }],
            createdAt: Date.now(),
          },
        });
      } else if (name === "tool.completed") {
        const queue = running.get(tool) ?? [];
        const toolCallId = queue.shift() ?? randomUUID();

        running.set(tool, queue);
        context.emit({
          type: "message",
          message: {
            id: toolCallId,
            role: "assistant",
            parts: [
              {
                type: "tool",
                toolCallId,
                toolName: tool,
                input: null,
                state: event.data.error === true ? "error" : "done",
                output: event.data.output ?? null,
              },
            ],
            createdAt: Date.now(),
          },
        });
      } else if (name === "approval.request") {
        const requestId = event.data.request_id;

        await hermes(`/v1/runs/${runId}/approval`, {
          method: "POST",
          body: JSON.stringify({ choice: "once", ...(requestId ? { request_id: requestId } : {}) }),
        });
      }

      if (name.startsWith("run.") && name !== "run.steered") {
        return;
      }
    }
  }
}

async function settle(runId: string, signal: AbortSignal): Promise<ContainerOutcome> {
  for (;;) {
    const response = await hermes(`/v1/runs/${runId}`);
    const snapshot = runSnapshotSchema.safeParse(await response.json().catch(() => null));

    if (snapshot.success && TERMINAL_STATUSES.has(snapshot.data.status)) {
      return snapshot.data.status === "completed"
        ? { status: "done", text: snapshot.data.output ?? "" }
        : { status: "unanswered", reason: snapshot.data.error ?? snapshot.data.status };
    }

    if (signal.aborted) {
      return { status: "unanswered", reason: "aborted" };
    }

    await delay(RUN_POLL_MS);
  }
}

const adapter: ContainerAdapter = {
  id: "hermes",
  version: process.env.HERMES_VERSION ?? "unknown",
  async open(context) {
    await startGateway();

    return {
      async run(turn) {
        await startGateway();

        const started = await hermes("/v1/runs", {
          method: "POST",
          body: JSON.stringify({
            input: inputText(turn.input),
            session_id: context.session,
            ...(context.settings.model ? { model: context.settings.model } : {}),
          }),
        });
        const runId = runStartedSchema.safeParse(await started.json().catch(() => null)).data
          ?.run_id;

        if (!runId) {
          return {
            status: "unanswered",
            reason: `Hermes did not start the run (${started.status})`,
          };
        }

        turn.signal.addEventListener(
          "abort",
          () => {
            void hermes(`/v1/runs/${runId}/stop`, { method: "POST" }).catch(() => undefined);
          },
          { once: true },
        );
        await followToolEvents(runId, context, turn.signal).catch((error: unknown) => {
          context.log("warn", error instanceof Error ? error.message : String(error));
        });

        return settle(runId, turn.signal);
      },
      async close() {},
    };
  },
};

await serveFromEnv(adapter);
