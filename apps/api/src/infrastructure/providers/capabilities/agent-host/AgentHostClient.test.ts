import { describe, expect, it, vi } from "vitest";

import { AgentHostClient } from "./AgentHostClient";

function workerFor(responses: Array<{ status: number; body: unknown }>) {
  const fetch = vi.fn(async () => {
    const next = responses.shift() ?? { status: 200, body: {} };

    return new Response(JSON.stringify(next.body), { status: next.status });
  });

  return { fetch };
}

describe("AgentHostClient", () => {
  it("maps concurrent-run pressure to a rate-limit error", async () => {
    const worker = workerFor([{ status: 429, body: { error: "Too many concurrent runs" } }]);
    const client = new AgentHostClient(worker as never);

    await expect(
      client.startRun({ hostId: "hermes-7", sessionId: "polychat-conv-1", input: "Hi" }),
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it("steers a live run", async () => {
    const runId = `run_${"c".repeat(32)}`;
    const accepted = new AgentHostClient(
      workerFor([{ status: 200, body: { run_id: runId, accepted: true } }]) as never,
    );

    await expect(
      accepted.steerRun({ hostId: "hermes-7", runId, input: "Also check X" }),
    ).resolves.toBeUndefined();
  });

  it("opens the run-events stream without consuming it", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`event: run.completed\ndata: {}\n\n`));
        controller.close();
      },
    });
    const fetch = vi.fn(async () => new Response(stream, { status: 200 }));
    const client = new AgentHostClient({ fetch } as never);

    const response = await client.openRunEvents({
      hostId: "hermes-7",
      runId: `run_${"c".repeat(32)}`,
    });

    expect(fetch).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.body).not.toBeNull();
    await response.body?.cancel();
  });

  it("rejects an unavailable events stream", async () => {
    const worker = workerFor([{ status: 502, body: { error: "Hermes is down" } }]);
    const client = new AgentHostClient(worker as never);

    await expect(
      client.openRunEvents({ hostId: "hermes-7", runId: `run_${"c".repeat(32)}` }),
    ).rejects.toThrow("Hermes is down");
  });
});
