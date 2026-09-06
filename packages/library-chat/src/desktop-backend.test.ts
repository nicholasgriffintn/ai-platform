import type { DesktopEndpoint, DesktopStreamEvent } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  createFakeDesktopBackend,
  resolveExecutionHandoff,
  type DesktopRun,
} from "./desktop-backend";

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

describe("resolveExecutionHandoff", () => {
  it("starts a new conversation when execution crosses the device boundary", () => {
    expect(resolveExecutionHandoff("device", "cloud")).toEqual({
      requiresNewConversation: true,
      carriesHistory: false,
    });
    expect(resolveExecutionHandoff("cloud", "device")).toEqual({
      requiresNewConversation: true,
      carriesHistory: false,
    });
  });

  it("keeps the conversation when execution stays on one side", () => {
    expect(resolveExecutionHandoff("device", "device")).toEqual({
      requiresNewConversation: false,
      carriesHistory: true,
    });
  });
});

const endpoint: DesktopEndpoint = {
  id: "endpoint-1",
  kind: "model",
  vendor: "ollama",
  label: "Ollama",
  url: "http://127.0.0.1:11434",
  transport: "loopback",
  pairingSecretStored: false,
  approvedAt: "2026-09-06T09:00:00.000Z",
  lastSeenAt: null,
};

describe("fake endpoint management", () => {
  it("lists an endpoint once it has been saved", async () => {
    const backend = createFakeDesktopBackend();

    await backend.saveEndpoint(endpoint);

    await expect(backend.listEndpoints()).resolves.toEqual([endpoint]);
  });

  it("replaces an endpoint saved again under the same id", async () => {
    const backend = createFakeDesktopBackend({ endpoints: [endpoint] });

    await backend.saveEndpoint({ ...endpoint, label: "Renamed" });
    const listed = await backend.listEndpoints();

    expect(listed).toHaveLength(1);
    expect(listed[0]?.label).toBe("Renamed");
  });

  it("forgets only the endpoint asked for", async () => {
    const backend = createFakeDesktopBackend({
      endpoints: [endpoint, { ...endpoint, id: "endpoint-2" }],
    });

    await backend.forgetEndpoint("endpoint-2");

    await expect(backend.listEndpoints()).resolves.toEqual([endpoint]);
  });
});

describe("interrupted replies", () => {
  it("keeps a stopped reply distinguishable from a finished one", async () => {
    const backend = createFakeDesktopBackend();

    await backend.appendMessage({
      id: "m1",
      conversationId: "c1",
      role: "assistant",
      content: "partial",
      status: "interrupted",
      createdAt: "2026-09-06T09:00:00.000Z",
    });
    await backend.appendMessage({
      id: "m2",
      conversationId: "c1",
      role: "assistant",
      content: "whole",
      status: "complete",
      createdAt: "2026-09-06T09:00:01.000Z",
    });

    const stored = await backend.listMessages("c1");

    expect(stored.map((message) => message.status)).toEqual(["interrupted", "complete"]);
  });
});
