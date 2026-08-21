import { beforeEach, describe, expect, it, vi } from "vitest";

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
    conversationManager: { getUsageLimits: vi.fn(async () => null) },
    toolRequestContext: { context: connectorContext },
    mode: "normal",
    env: {},
  } as never;
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
    await turnStarted;
    await reader.cancel("client disconnected");

    expect(mocks.closeComposioConnectorRun).not.toHaveBeenCalled();

    finishTurn();
    await vi.waitFor(() => expect(mocks.closeComposioConnectorRun).toHaveBeenCalledOnce());
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
