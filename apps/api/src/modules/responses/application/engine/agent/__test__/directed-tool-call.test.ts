import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolCallType, type Message } from "~/types";

import { runAgentLoop, type AgentLoopExecutionParams } from "../agent-loop";

const mocks = vi.hoisted(() => ({
  handleToolCalls: vi.fn(),
  finaliseAssistantTurn: vi.fn(),
  runTurn: vi.fn(),
}));

vi.mock("~/modules/responses/application/engine/tools/execution", () => ({
  handleToolCalls: mocks.handleToolCalls,
}));
vi.mock("~/modules/responses/application/engine/agent/assistant-turn", () => ({
  finaliseAssistantTurn: mocks.finaliseAssistantTurn,
}));
vi.mock("~/modules/responses/application/engine/agent/conversation-title", () => ({
  startConversationTitle: () => ({ complete: vi.fn(async () => undefined) }),
}));

const toolCall = {
  id: "call-1",
  type: ToolCallType.FUNCTION,
  function: { name: "compare_and_conclude", arguments: "{}" },
};

const directedToolCall = {
  toolCall,
  readClosingReply: (result: Message | undefined) => `closing: ${String(result?.content)}`,
};

function runDirectedTurn() {
  return runAgentLoop({
    requestParams: { messages: [{ role: "user", content: "Compare" }], enabled_tools: [] },
    completionId: "conversation",
    conversationManager: { getUsageLimits: vi.fn(async () => null), add: vi.fn() },
    toolRequestContext: { request: {} },
    transport: { streams: false, runTurn: mocks.runTurn },
    maxSteps: 4,
    env: {},
    model: "chat-model",
    provider: "vendor",
    platform: "web",
    mode: "normal",
    memoryScope: { type: "personal" },
    directedToolCall,
  } as unknown as AgentLoopExecutionParams);
}

describe("a directed tool call", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.finaliseAssistantTurn.mockImplementation(async ({ turn, messageId }) => ({
      message: { id: messageId, role: "assistant", content: turn.content },
      guardrailsPassed: true,
      guardrailViolations: [],
    }));
  });

  it("runs the tool and closes the turn with its reply without calling the model", async () => {
    mocks.handleToolCalls.mockResolvedValue([
      { role: "tool", tool_call_id: "call-1", status: "success", content: "Concluded." },
    ]);

    const result = await runDirectedTurn();

    expect(mocks.runTurn).not.toHaveBeenCalled();
    expect(mocks.handleToolCalls).toHaveBeenCalledTimes(1);
    expect(result.response.response).toBe("closing: Concluded.");
    expect(result.response.status).toBeUndefined();
  });

  it("closes the turn as incomplete when the tool fails", async () => {
    mocks.handleToolCalls.mockResolvedValue([
      { role: "tool", tool_call_id: "call-1", status: "error", content: "No models." },
    ]);

    const result = await runDirectedTurn();

    expect(mocks.runTurn).not.toHaveBeenCalled();
    expect(result.response.response).toBe("closing: No models.");
    expect(result.response.status).toBe("incomplete");
  });

  it("waits for the person when the tool needs approval", async () => {
    mocks.handleToolCalls.mockResolvedValue([
      {
        role: "tool",
        tool_call_id: "call-1",
        status: "pending",
        content: "Approve this?",
        data: { humanInTheLoop: { required: true } },
      },
    ]);

    const result = await runDirectedTurn();

    expect(result.response.response).toBe("Approve this?");
    expect(result.response.status).toBe("pending");
  });
});
