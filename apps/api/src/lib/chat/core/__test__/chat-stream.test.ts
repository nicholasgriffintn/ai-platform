import { parseChatStreamSseBuffer } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readStringField } from "~/utils/recordFields";

const mocks = vi.hoisted(() => ({
  runAgentLoop: vi.fn(),
  closeComposioConnectorRun: vi.fn(async () => {}),
}));

vi.mock("~/lib/chat/agent/agent-loop", () => ({ runAgentLoop: mocks.runAgentLoop }));
vi.mock("~/services/apps/connectors/composio-run", () => ({
  closeComposioConnectorRun: mocks.closeComposioConnectorRun,
}));

import { createChatTurnStream } from "../chat-stream";

const connectorContext = { requestId: "request-1" };

function createParams() {
  return {
    completionId: "completion-1",
    conversationManager: {
      getUsageLimits: vi.fn(async () => null),
      releaseTurnReservation: vi.fn(),
    },
    toolRequestContext: { context: connectorContext },
    mode: "normal",
    env: {},
  } as never;
}

async function readEvents(stream: ReadableStream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let body = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    body += decoder.decode(value, { stream: true });
  }

  body += decoder.decode();

  return parseChatStreamSseBuffer(body, { flush: true }).events;
}

describe("createChatTurnStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the turn running when the client disconnects mid-turn", async () => {
    let startTurn: () => void = () => {};

    let finishTurn: () => void = () => {};

    const turnStarted = new Promise<void>((resolve) => {
      startTurn = resolve;
    });

    mocks.runAgentLoop.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishTurn = () => resolve();
          startTurn();
        }),
    );

    const stream = createChatTurnStream(createParams());
    const reader = stream.getReader();

    await reader.read();
    await reader.read();
    await turnStarted;
    await reader.cancel("client disconnected");

    expect(mocks.closeComposioConnectorRun).not.toHaveBeenCalled();

    finishTurn();
    await vi.waitFor(() => expect(mocks.closeComposioConnectorRun).toHaveBeenCalledOnce());
  });

  it("closes the connector run once for a turn that finishes normally", async () => {
    mocks.runAgentLoop.mockResolvedValue({ response: {} });

    const stream = createChatTurnStream(createParams());
    const events = await readEvents(stream);

    expect(mocks.closeComposioConnectorRun).toHaveBeenCalledOnce();
    expect(events.filter((event) => event.type === "turn_activity")).toEqual([
      { type: "turn_activity", kind: "turn_started" },
      { type: "turn_activity", kind: "turn_finished", outcome: "completed" },
    ]);
  });

  it("emits terminal failure activity before the public error", async () => {
    mocks.runAgentLoop.mockRejectedValue(new Error("provider failed"));

    const events = await readEvents(createChatTurnStream(createParams()));
    const terminalIndex = events.findIndex((event) => {
      if (event.type !== "turn_activity") {
        return false;
      }

      return readStringField(event, "kind") === "turn_finished";
    });
    const errorIndex = events.findIndex((event) => event.type === "error");

    expect(events[terminalIndex]).toEqual({
      type: "turn_activity",
      kind: "turn_finished",
      outcome: "failed",
      errorType: "PROVIDER_ERROR",
    });
    expect(terminalIndex).toBeLessThan(errorIndex);
  });
});
