import type { DesktopStreamEvent } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { createFakeDesktopBackend, type DesktopRun } from "./desktop-backend";

const script: DesktopStreamEvent[] = [
  { type: "progress", runId: "seed", state: "loading-model" },
  { type: "text", runId: "seed", delta: "Hello" },
  { type: "text", runId: "seed", delta: " there" },
  { type: "finished", runId: "seed", reason: "complete", at: "2026-09-06T09:00:00.000Z" },
];

async function collect(run: DesktopRun): Promise<DesktopStreamEvent[]> {
  const events: DesktopStreamEvent[] = [];

  for await (const event of run.events) {
    events.push(event);
  }

  return events;
}

describe("createFakeDesktopBackend", () => {
  it("stamps every streamed event with the run it belongs to", async () => {
    const backend = createFakeDesktopBackend({ script });
    const run = await backend.startModelRun({
      endpointId: "endpoint-1",
      nativeModelId: "gpt-oss:20b",
      conversationId: "conversation-1",
      messages: [{ role: "user", content: "hello" }],
      maxOutputTokens: null,
    });

    const events = await collect(run);

    expect(events.map((event) => event.runId)).toEqual(Array(4).fill(run.runId));
    expect(events.at(-1)).toMatchObject({ type: "finished", reason: "complete" });
  });

  it("ends a cancelled run as cancelled rather than complete", async () => {
    const backend = createFakeDesktopBackend({ script });
    const run = await backend.startModelRun({
      endpointId: "endpoint-1",
      nativeModelId: "gpt-oss:20b",
      conversationId: "conversation-1",
      messages: [{ role: "user", content: "hello" }],
      maxOutputTokens: null,
    });

    run.cancel();
    const events = await collect(run);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "finished", reason: "cancelled" });
    expect(backend.cancelledRuns).toEqual([run.runId]);
  });

  it("reports an unprobed endpoint as unreachable rather than ready", async () => {
    const backend = createFakeDesktopBackend();

    await expect(backend.probeEndpoint("missing")).resolves.toMatchObject({
      status: "unreachable",
    });
  });

  it("records approval decisions against their endpoint", async () => {
    const backend = createFakeDesktopBackend();

    await backend.decideApproval("endpoint-2", {
      requestId: "approval-1",
      approved: false,
      decidedAt: "2026-09-06T09:00:00.000Z",
    });

    expect(backend.decisions).toEqual([
      {
        endpointId: "endpoint-2",
        decision: {
          requestId: "approval-1",
          approved: false,
          decidedAt: "2026-09-06T09:00:00.000Z",
        },
      },
    ]);
  });
});
