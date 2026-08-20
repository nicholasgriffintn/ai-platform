import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAIResponse: vi.fn(),
  handleToolCalls: vi.fn(),
}));

vi.mock("~/lib/chat/responses", () => ({
  getAIResponse: mocks.getAIResponse,
}));

vi.mock("~/lib/chat/tools", () => ({
  handleToolCalls: mocks.handleToolCalls,
}));

import { runAgentLoop } from "../runAgentLoop";

const artifactToolResponse = {
  response: "",
  tool_calls: [
    {
      id: "call-artifact",
      function: { name: "artifact", arguments: "{}" },
    },
  ],
};

const recoverableUnknownToolResult = {
  role: "tool",
  name: "artifact",
  content: "Artifacts are response markup, not tools.",
  status: "error",
  tool_call_id: "call-artifact",
  data: { errorCode: "UNKNOWN_TOOL", recoverable: true },
};

function createParams(maxSteps = 8) {
  return {
    requestParams: { messages: [{ role: "user", content: "hi" }] } as any,
    completionId: "completion-123",
    conversationManager: {
      add: vi.fn(),
      checkUsageLimits: vi.fn(),
      getUsageLimits: vi.fn(async () => ({ daily: { used: 1, limit: 100 } })),
    } as any,
    toolRequestContext: { env: { AI: {} } } as any,
    maxSteps,
  };
}

describe("runAgentLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the model text when no tools are called", async () => {
    mocks.getAIResponse.mockResolvedValueOnce({ response: "Just an answer." });

    const result = await runAgentLoop(createParams());

    expect(result.response.response).toBe("Just an answer.");
    expect(mocks.handleToolCalls).not.toHaveBeenCalled();
  });

  it("executes tool calls then finishes on the follow-up text turn", async () => {
    mocks.getAIResponse
      .mockResolvedValueOnce({
        response: "",
        tool_calls: [{ id: "call-1", function: { name: "get_weather", arguments: "{}" } }],
      })
      .mockResolvedValueOnce({ response: "It is sunny." });
    mocks.handleToolCalls.mockResolvedValueOnce([
      { role: "tool", name: "get_weather", content: "sunny", status: "success" },
    ]);

    const result = await runAgentLoop(createParams());

    expect(mocks.handleToolCalls).toHaveBeenCalledTimes(1);
    expect(result.response.response).toBe("It is sunny.");
    expect(result.toolResponses).toHaveLength(1);
  });

  it("gives an unknown tool call one corrective model turn", async () => {
    mocks.getAIResponse
      .mockResolvedValueOnce(artifactToolResponse)
      .mockResolvedValueOnce({ response: "Recovered without the tool." });
    mocks.handleToolCalls.mockResolvedValueOnce([recoverableUnknownToolResult]);

    const result = await runAgentLoop(createParams());

    expect(mocks.handleToolCalls).toHaveBeenCalledTimes(1);
    expect(mocks.handleToolCalls.mock.calls[0][4]).toEqual({ recoverUnknownToolCalls: true });
    expect(result.response.response).toBe("Recovered without the tool.");
  });

  it("does not grant a second recovery turn for a repeated unknown tool call", async () => {
    mocks.getAIResponse
      .mockResolvedValueOnce(artifactToolResponse)
      .mockResolvedValueOnce(artifactToolResponse)
      .mockResolvedValueOnce({ response: "Giving up on that tool." });
    mocks.handleToolCalls
      .mockResolvedValueOnce([recoverableUnknownToolResult])
      .mockResolvedValueOnce([recoverableUnknownToolResult]);

    await runAgentLoop(createParams());

    expect(mocks.handleToolCalls.mock.calls[1][4]).toEqual({ recoverUnknownToolCalls: false });
  });

  it("stops for user approval when a tool result is pending", async () => {
    mocks.getAIResponse.mockResolvedValueOnce({
      response: "",
      tool_calls: [{ id: "call-1", function: { name: "request_approval", arguments: "{}" } }],
    });
    mocks.handleToolCalls.mockResolvedValueOnce([
      {
        role: "tool",
        name: "request_approval",
        content: "Waiting on you to approve the deploy.",
        status: "pending",
      },
    ]);

    const result = await runAgentLoop(createParams());

    expect(result.response.status).toBe("pending");
    expect(result.response.response).toBe("Waiting on you to approve the deploy.");
    expect(mocks.getAIResponse).toHaveBeenCalledTimes(1);
  });

  it("ends with the work already done when the user runs out mid-run", async () => {
    mocks.getAIResponse.mockResolvedValue({
      response: "Checked the first thing",
      tool_calls: [{ id: "call-1", function: { name: "get_weather", arguments: "{}" } }],
    });
    mocks.handleToolCalls.mockResolvedValue([
      { role: "tool", name: "get_weather", content: "sunny", status: "success" },
    ]);

    const params = createParams();

    params.conversationManager.getUsageLimits = vi.fn(async () => ({
      daily: { used: 100, limit: 100 },
    }));

    const result = await runAgentLoop(params);

    // The turn is returned rather than thrown away: the user keeps the work
    // they already paid for, and is told why it stopped.
    expect(result.response.status).toBe("usage_limit_reached");
    expect(result.response.response).toContain("reached your usage limit");
    expect(result.toolResponses).toHaveLength(1);
    expect(mocks.getAIResponse).toHaveBeenCalledTimes(1);
  });

  it("does not re-check the limit for the first step, which the request boundary already covered", async () => {
    mocks.getAIResponse.mockResolvedValueOnce({ response: "Just an answer." });

    const params = createParams();

    await runAgentLoop(params);

    expect(params.conversationManager.getUsageLimits).not.toHaveBeenCalled();
  });

  it("holds the loop open while assessFinish withholds approval", async () => {
    mocks.getAIResponse
      .mockResolvedValueOnce({ response: "All done." })
      .mockResolvedValueOnce({ response: "Actually done now." });

    let allow = false;
    const result = await runAgentLoop({
      ...createParams(),
      assessFinish: () => {
        if (allow) {
          return { allow: true, outcome: "satisfied" as const };
        }

        allow = true;

        return { allow: false, instruction: "The tests have not been run yet." };
      },
    });

    expect(mocks.getAIResponse).toHaveBeenCalledTimes(2);
    expect(result.response.response).toBe("Actually done now.");
  });
});
