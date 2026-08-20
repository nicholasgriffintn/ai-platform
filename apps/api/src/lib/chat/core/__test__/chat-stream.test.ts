import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runAgentLoop: vi.fn(),
  closeComposioConnectorRun: vi.fn(async () => {}),
}));

vi.mock("~/lib/chat/agent/runAgentLoop", () => ({ runAgentLoop: mocks.runAgentLoop }));
vi.mock("~/services/apps/connectors/composio-run", () => ({
  closeComposioConnectorRun: mocks.closeComposioConnectorRun,
}));

import { createChatTurnStream } from "../chat-stream";

const connectorContext = { requestId: "request-1" };

function createParams() {
  return {
    completionId: "completion-1",
    conversationManager: { getUsageLimits: vi.fn(async () => null) },
    toolRequestContext: { context: connectorContext },
    mode: "normal",
  } as never;
}

describe("createChatTurnStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("closes the connector run when the client disconnects mid-turn", async () => {
    let startTurn: () => void = () => {};

    const turnStarted = new Promise<void>((resolve) => {
      startTurn = resolve;
    });

    mocks.runAgentLoop.mockImplementation(() => {
      startTurn();

      return new Promise(() => {});
    });

    const stream = createChatTurnStream(createParams());
    const reader = stream.getReader();

    await reader.read();
    await turnStarted;
    await reader.cancel("client disconnected");

    expect(mocks.closeComposioConnectorRun).toHaveBeenCalledWith(connectorContext);
  });

  it("closes the connector run once for a turn that finishes normally", async () => {
    mocks.runAgentLoop.mockResolvedValue({});

    const stream = createChatTurnStream(createParams());
    const reader = stream.getReader();

    while (!(await reader.read()).done) {
      // drain
    }

    expect(mocks.closeComposioConnectorRun).toHaveBeenCalledOnce();
  });
});
