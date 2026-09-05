import { CAPABILITY_DISCOVERY_DATA_KEY } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { handleToolCalls } from "~/lib/chat/tools/execution";

const mocks = vi.hoisted(() => ({
  handleToolCalls: vi.fn(),
}));

vi.mock("~/lib/chat/tools/execution", () => ({
  handleToolCalls: mocks.handleToolCalls,
}));

import type { ChatEventSink } from "~/lib/chat/streaming/emitter";
import type { ChatCompletionParameters, Message } from "~/types";

import { runAgentLoop } from "../agent-loop";
import type { TurnOutput } from "../assistant-turn";
import type { ChatTurnTransport } from "../turn-transport";

const unknownToolCall = {
  id: "call-missing",
  function: { name: "missing_tool", arguments: "{}" },
};

const unknownToolTurn: TurnOutput = { content: "", toolCalls: [unknownToolCall] as never };

const recoverableUnknownToolResult = {
  role: "tool",
  name: "missing_tool",
  content: "That tool is not available.",
  status: "error",
  tool_call_id: "call-missing",
  data: { errorCode: "UNKNOWN_TOOL", recoverable: true },
};

const artifactToolTurn = toolTurn(
  "artifact_identifier</arg_key><arg_value>orbital-visualisation</arg_value>",
  "call-artifact",
);

const artifactToolResult = {
  role: "tool",
  name: "artifact_identifier</arg_key><arg_value>orbital-visualisation</arg_value>",
  content: "Artifacts are response markup, not tools.",
  status: "error",
  tool_call_id: "call-artifact",
  data: { errorCode: "UNKNOWN_TOOL", recoverable: true },
};

function textTurn(content: string): TurnOutput {
  return { content, toolCalls: [] };
}

function toolTurn(name: string, id = "call-1"): TurnOutput {
  return { content: "", toolCalls: [{ id, function: { name, arguments: "{}" } }] as never };
}

function createTransport(turns: TurnOutput[]) {
  const runTurn = vi.fn(async (_input: { request: ChatCompletionParameters }) => {
    const turn = turns.length > 1 ? turns.shift() : turns[0];

    if (!turn) {
      throw new Error("The transport ran out of queued turns");
    }

    return turn;
  });

  return { transport: { streams: false, runTurn } as ChatTurnTransport, runTurn };
}

function creditSummary(overrides: Record<string, unknown> = {}) {
  return {
    included: 100,
    used: 1,
    reserved: 0,
    grace: 20,
    overrun: 0,
    overage: 0,
    overage_enabled: false,
    state: "ok",
    ...overrides,
  };
}

function createParams(turns: TurnOutput[], maxSteps = 8) {
  const { transport, runTurn } = createTransport(turns);
  const sink = { writeEvent: vi.fn<ChatEventSink["writeEvent"]>(async () => {}) };

  return {
    params: {
      requestParams: { messages: [{ role: "user", content: "hi" }] } as any,
      completionId: "completion-123",
      conversationManager: {
        add: vi.fn(),
        get: vi.fn(async () => []),
        creditActor: vi.fn(() => ({ kind: "user", userId: 1 })),
        getUsageLimits: vi.fn(async () => ({ credits: creditSummary() })),
        releaseTurnReservation: vi.fn(),
      } as any,
      toolRequestContext: { env: { AI: {} }, request: { enabled_tools: [] } } as any,
      transport,
      maxSteps,
      env: { AI: {} } as any,
      model: "test-model",
      provider: "test-provider",
      platform: "api" as const,
      mode: "normal",
      memoryScope: { type: "personal" } as const,
      sink,
    },
    runTurn,
    sink,
  };
}

describe("runAgentLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the model text when no tools are called", async () => {
    const { params } = createParams([textTurn("Just an answer.")]);

    const result = await runAgentLoop(params);

    expect(result.response.response).toBe("Just an answer.");
    expect(mocks.handleToolCalls).not.toHaveBeenCalled();
  });

  it("stores the assistant message for every turn it runs", async () => {
    const { params } = createParams([toolTurn("get_weather"), textTurn("It is sunny.")]);

    mocks.handleToolCalls.mockResolvedValueOnce([
      { role: "tool", name: "get_weather", content: "sunny", status: "success" },
    ]);

    await runAgentLoop(params);

    expect(params.conversationManager.add).toHaveBeenCalledTimes(2);
  });

  it("executes tool calls then finishes on the follow-up text turn", async () => {
    const { params, runTurn } = createParams([toolTurn("get_weather"), textTurn("It is sunny.")]);

    mocks.handleToolCalls.mockResolvedValueOnce([
      { role: "tool", name: "get_weather", content: "sunny", status: "success" },
    ]);

    const result = await runAgentLoop(params);

    expect(mocks.handleToolCalls).toHaveBeenCalledTimes(1);
    expect(runTurn).toHaveBeenCalledTimes(2);
    expect(result.response.response).toBe("It is sunny.");
    expect(result.toolResponses).toHaveLength(1);
  });

  it("emits semantic activity in model, tool, and response order", async () => {
    const { params, sink } = createParams([
      toolTurn("get_weather", "call-weather"),
      textTurn("It is sunny."),
    ]);
    const toolResult: Message = {
      id: "result-weather",
      role: "tool",
      name: "get_weather",
      content: "sunny",
      status: "success",
      tool_call_id: "call-weather",
    };

    mocks.handleToolCalls.mockImplementationOnce(
      async (...args: Parameters<typeof handleToolCalls>) => {
        const options = args[4];

        await options.onToolExecutionStart({ id: "call-weather", name: "get_weather" });
        await options.onToolResult(toolResult);

        return [toolResult];
      },
    );

    await runAgentLoop(params);

    const activities = sink.writeEvent.mock.calls
      .filter(([type]) => type === "turn_activity")
      .map(([, activity]) => activity);

    expect(activities).toEqual([
      { kind: "model_step_started", step: 1 },
      { kind: "model_step_finished", step: 1, outcome: "tool_calls" },
      {
        kind: "tool_input_started",
        step: 1,
        toolCallId: "call-weather",
        toolName: "get_weather",
      },
      {
        kind: "tool_input_finished",
        step: 1,
        toolCallId: "call-weather",
        toolName: "get_weather",
      },
      {
        kind: "tool_execution_started",
        step: 1,
        toolCallId: "call-weather",
        toolName: "get_weather",
      },
      {
        kind: "tool_finished",
        step: 1,
        toolCallId: "call-weather",
        toolName: "get_weather",
        outcome: "success",
      },
      { kind: "model_step_started", step: 2 },
      { kind: "response_started", step: 2 },
      { kind: "response_finished", step: 2 },
      { kind: "model_step_finished", step: 2, outcome: "completed" },
    ]);
  });

  it("emits a waiting transition without claiming the tool executed", async () => {
    const { params, sink } = createParams([toolTurn("ask_user", "call-question")]);
    const pendingResult: Message = {
      id: "result-question",
      role: "tool",
      name: "ask_user",
      content: "Which environment?",
      status: "pending",
      tool_call_id: "call-question",
    };

    mocks.handleToolCalls.mockImplementationOnce(
      async (...args: Parameters<typeof handleToolCalls>) => {
        await args[4].onToolResult(pendingResult);

        return [pendingResult];
      },
    );

    await runAgentLoop(params);

    const activities = sink.writeEvent.mock.calls
      .filter(([type]) => type === "turn_activity")
      .map(([, activity]) => activity);

    expect(activities).toContainEqual({
      kind: "waiting_for_user",
      step: 1,
      toolCallId: "call-question",
      toolName: "ask_user",
      reason: "question",
    });
    expect(activities).not.toContainEqual(
      expect.objectContaining({ kind: "tool_execution_started", toolCallId: "call-question" }),
    );
  });

  it("labels an existing council picker as a selection wait", async () => {
    const { params, sink } = createParams([toolTurn("select_council_members", "call-selection")]);
    const pendingResult: Message = {
      id: "result-selection",
      role: "tool",
      name: "select_council_members",
      content: "Choose the council members.",
      status: "pending",
      tool_call_id: "call-selection",
      data: {
        humanInTheLoop: {
          type: "selection",
          status: "pending",
          requires_user_action: true,
        },
      },
    };

    mocks.handleToolCalls.mockImplementationOnce(
      async (...args: Parameters<typeof handleToolCalls>) => {
        await args[4].onToolResult(pendingResult);

        return [pendingResult];
      },
    );

    await runAgentLoop(params);

    expect(
      sink.writeEvent.mock.calls
        .filter(([type]) => type === "turn_activity")
        .map(([, activity]) => activity),
    ).toContainEqual({
      kind: "waiting_for_user",
      step: 1,
      toolCallId: "call-selection",
      toolName: "select_council_members",
      reason: "selection",
    });
  });

  it("activates a discovered native tool for the rest of the response", async () => {
    const { params, runTurn } = createParams([
      toolTurn("discover_capabilities", "discover-call"),
      toolTurn("create_qr_code", "qr-call"),
      textTurn("Here is your QR code."),
    ]);

    mocks.handleToolCalls
      .mockResolvedValueOnce([
        {
          role: "tool",
          name: "discover_capabilities",
          content: "Create QR code is ready to use.",
          status: "success",
          data: {
            [CAPABILITY_DISCOVERY_DATA_KEY]: {
              query: "create a QR code",
              total: 1,
              items: [
                {
                  id: "tool:create_qr_code",
                  kind: "tool",
                  name: "Create QR code",
                  configured: true,
                  state: "ready",
                  reason: "This tool will be enabled automatically for this response.",
                  tags: ["tool", "normal"],
                  invocation: {
                    toolName: "create_qr_code",
                    availableNow: true,
                    autoActivate: true,
                    instruction: "Call create_qr_code using its declared parameter schema.",
                  },
                },
              ],
            },
          },
        },
      ])
      .mockResolvedValueOnce([
        { role: "tool", name: "create_qr_code", content: "created", status: "success" },
      ]);

    const result = await runAgentLoop(params);

    expect(runTurn.mock.calls[1][0].request.enabled_tools).toContain("create_qr_code");
    expect(params.toolRequestContext.request.enabled_tools).toContain("create_qr_code");
    expect(result.response.response).toBe("Here is your QR code.");
  });

  it("activates the tools a loaded skill needs, companions included", async () => {
    const { params, runTurn } = createParams([
      toolTurn("load_skill", "skill-call"),
      textTurn("Done."),
    ]);

    mocks.handleToolCalls.mockResolvedValueOnce([
      {
        role: "tool",
        name: "load_skill",
        content: "Skill instructions.",
        status: "success",
        data: { activatedTools: ["run_pashi_tools"] },
      },
    ]);

    await runAgentLoop(params);

    expect(runTurn.mock.calls[1][0].request.enabled_tools).toEqual(
      expect.arrayContaining(["run_pashi_tools", "search_pashi_tools"]),
    );
  });

  it("ignores an activation marker from a tool that relays external data", async () => {
    const { params, runTurn } = createParams([
      toolTurn("use_recipe_connector", "connector-call"),
      textTurn("Done."),
    ]);

    mocks.handleToolCalls.mockResolvedValueOnce([
      {
        role: "tool",
        name: "use_recipe_connector",
        content: "Connector output.",
        status: "success",
        data: { activatedTools: ["run_sandbox_task"] },
      },
    ]);

    await runAgentLoop(params);

    expect(runTurn.mock.calls[1][0].request.enabled_tools).not.toContain("run_sandbox_task");
  });

  it("keeps working after a tool fails rather than ending the turn", async () => {
    const { params } = createParams([toolTurn("get_weather"), textTurn("I could not check.")]);

    mocks.handleToolCalls.mockResolvedValueOnce([
      { role: "tool", name: "get_weather", content: "upstream is down", status: "error" },
    ]);

    const result = await runAgentLoop(params);

    expect(result.response.response).toBe("I could not check.");
  });

  it("gives an unknown tool call one corrective model turn", async () => {
    const { params, runTurn } = createParams([
      unknownToolTurn,
      textTurn("Recovered without the tool."),
    ]);

    mocks.handleToolCalls.mockResolvedValueOnce([recoverableUnknownToolResult]);

    const result = await runAgentLoop(params);

    expect(mocks.handleToolCalls).toHaveBeenCalledTimes(1);
    expect(mocks.handleToolCalls.mock.calls[0][4]).toMatchObject({
      recoverUnknownToolCalls: true,
    });
    expect(runTurn.mock.calls[1][0].request.disable_functions).toBeUndefined();
    expect(result.response.response).toBe("Recovered without the tool.");
  });

  it("does not grant a second recovery turn for a repeated unknown tool call", async () => {
    const { params, runTurn } = createParams([
      unknownToolTurn,
      unknownToolTurn,
      textTurn("Giving up on that tool."),
    ]);

    mocks.handleToolCalls
      .mockResolvedValueOnce([recoverableUnknownToolResult])
      .mockResolvedValueOnce([recoverableUnknownToolResult]);

    await runAgentLoop(params);

    expect(mocks.handleToolCalls.mock.calls[1][4]).toMatchObject({
      recoverUnknownToolCalls: false,
    });
    expect(runTurn.mock.calls[2][0].request.disable_functions).toBe(true);
  });

  it("forces artifact-shaped unknown tools into a tool-free response", async () => {
    const { params, runTurn } = createParams([
      artifactToolTurn,
      textTurn('<artifact identifier="orbit" type="text/html">...</artifact>'),
    ]);

    mocks.handleToolCalls.mockResolvedValueOnce([artifactToolResult]);

    const result = await runAgentLoop(params);

    expect(runTurn.mock.calls[1][0].request.disable_functions).toBe(true);
    expect(runTurn.mock.calls[1][0].request.messages.at(-1)?.content).toContain(
      "Artifacts are response markup, not tools",
    );
    expect(result.response.response).toContain("<artifact");
  });

  it("stops for user approval when a tool result is pending", async () => {
    const { params, runTurn, sink } = createParams([toolTurn("request_approval")]);

    mocks.handleToolCalls.mockResolvedValueOnce([
      {
        role: "tool",
        name: "request_approval",
        content: "Waiting on you to approve the deploy.",
        status: "pending",
      },
    ]);

    const result = await runAgentLoop(params);

    expect(result.response.status).toBe("pending");
    expect(result.response.response).toBe("Waiting on you to approve the deploy.");
    expect(runTurn).toHaveBeenCalledTimes(1);
    expect(sink.writeEvent).toHaveBeenCalledWith(
      "message_delta",
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("tells the goal gate that a pending question is waiting for the user", async () => {
    const { params } = createParams([toolTurn("ask_user")]);
    const assessFinish = vi.fn().mockResolvedValue({ allow: true, outcome: "blocked" });

    mocks.handleToolCalls.mockResolvedValueOnce([
      {
        role: "tool",
        name: "ask_user",
        content: "Which tone should I use?",
        status: "pending",
      },
    ]);

    await runAgentLoop({ ...params, assessFinish });

    expect(assessFinish).toHaveBeenCalledWith(
      expect.objectContaining({ awaitingUserAction: "question" }),
    );
  });

  it("keeps an admitted turn running through the reserve", async () => {
    const { params, runTurn } = createParams([toolTurn("get_weather"), textTurn("Done.")]);

    mocks.handleToolCalls.mockResolvedValueOnce([
      { role: "tool", name: "get_weather", content: "sunny", status: "success" },
    ]);
    params.conversationManager.getUsageLimits = vi.fn(async () => ({
      credits: creditSummary({ used: 110, state: "reserve" }),
    }));

    const result = await runAgentLoop(params);

    expect(result.response.status).not.toBe("usage_limit_reached");
    expect(result.response.response).toBe("Done.");
    expect(runTurn).toHaveBeenCalledTimes(2);
  });

  it("stops an admitted turn only at the runaway ceiling", async () => {
    const { params, runTurn } = createParams([toolTurn("get_weather")]);

    mocks.handleToolCalls.mockResolvedValue([
      { role: "tool", name: "get_weather", content: "sunny", status: "success" },
    ]);
    params.conversationManager.getUsageLimits = vi.fn(async () => ({
      credits: creditSummary({ used: 146, state: "exhausted" }),
    }));

    const result = await runAgentLoop(params);

    expect(result.response.status).toBe("usage_limit_reached");
    expect(result.response.response).toContain("reached your usage limit");
    expect(runTurn).toHaveBeenCalledTimes(1);
  });

  it("does not re-check the limit for the first step, which the request boundary already covered", async () => {
    const { params } = createParams([textTurn("Just an answer.")]);

    await runAgentLoop(params);

    expect(params.conversationManager.getUsageLimits).not.toHaveBeenCalled();
  });

  it("holds the loop open while assessFinish withholds approval", async () => {
    const { params, runTurn } = createParams([textTurn("All done."), textTurn("Actually done.")]);

    let allow = false;
    const result = await runAgentLoop({
      ...params,
      assessFinish: () => {
        if (allow) {
          return { allow: true, outcome: "satisfied" as const };
        }

        allow = true;

        return { allow: false, instruction: "The tests have not been run yet." };
      },
    });

    expect(runTurn).toHaveBeenCalledTimes(2);
    expect(result.response.response).toBe("Actually done.");
  });

  it("publishes tool results to the turn lifecycle before assessing finish", async () => {
    const { params } = createParams([
      toolTurn("set_goal", "set-call"),
      textTurn("The artifact is ready."),
      toolTurn("complete_goal", "complete-call"),
      textTurn("Done."),
    ]);
    let goalStatus: "none" | "active" | "completed" = "none";
    const results = [
      {
        role: "tool",
        name: "set_goal",
        content: "Goal set",
        status: "success",
        data: { goal: { status: "active" } },
      },
      {
        role: "tool",
        name: "complete_goal",
        content: "Goal completed",
        status: "success",
        data: { goal: { status: "completed" } },
      },
    ];

    mocks.handleToolCalls.mockImplementation(async (...args: any[]) => {
      const result = results.shift();

      if (!result) {
        return [];
      }

      await args[4]?.onToolResult?.(result);

      return [result];
    });

    const result = await runAgentLoop({
      ...params,
      onToolResult: async (toolResult) => {
        goalStatus = toolResult.data?.goal?.status ?? goalStatus;
      },
      assessFinish: () =>
        goalStatus === "active"
          ? { allow: false, instruction: "Complete the active goal." }
          : { allow: true, outcome: "satisfied" as const },
    });

    expect(result.response.response).toBe("Done.");
    expect(mocks.handleToolCalls).toHaveBeenCalledTimes(2);
  });

  it("reserves tool-enabled finalisation steps for a goal created at the step ceiling", async () => {
    const { params, runTurn } = createParams(
      [
        toolTurn("set_goal", "set-call"),
        toolTurn("complete_goal", "complete-call"),
        textTurn("Done."),
      ],
      1,
    );
    let goalActive = false;
    const results = [
      {
        role: "tool",
        name: "set_goal",
        content: "Goal set",
        status: "success",
        data: { goal: { status: "active" } },
      },
      {
        role: "tool",
        name: "complete_goal",
        content: "Goal completed",
        status: "success",
        data: { goal: { status: "completed" } },
      },
    ];

    mocks.handleToolCalls.mockImplementation(async (...args: any[]) => {
      const result = results.shift();

      if (!result) {
        return [];
      }

      await args[4]?.onToolResult?.(result);

      return [result];
    });

    const result = await runAgentLoop({
      ...params,
      onToolResult: async (toolResult) => {
        goalActive = toolResult.data?.goal?.status === "active";
      },
      shouldReserveGoalFinalisation: () => goalActive,
      assessFinish: () => ({ allow: true, outcome: "satisfied" as const }),
    });

    expect(runTurn.mock.calls[1][0].request.disable_functions).toBeUndefined();
    expect(runTurn.mock.calls[1][0].request.messages.at(-1)?.content).toContain(
      "Resolve the active goal",
    );
    expect(result.response.response).toBe("Done.");
  });

  it("shares one tool call ledger across every step of a run", async () => {
    const { params } = createParams([
      toolTurn("load_skill", "call-1"),
      toolTurn("load_skill", "call-2"),
      textTurn("Done."),
    ]);

    mocks.handleToolCalls.mockResolvedValue([
      { role: "tool", name: "load_skill", content: "loaded", status: "success" },
    ]);

    await runAgentLoop(params);

    const [firstOptions, secondOptions] = mocks.handleToolCalls.mock.calls.map((call) => call[4]);

    expect(firstOptions.callLedger).toBeInstanceOf(Map);
    expect(secondOptions.callLedger).toBe(firstOptions.callLedger);
  });

  it("disables tools after the repeated-call guard fires", async () => {
    const { params, runTurn } = createParams([
      toolTurn("load_skill", "call-1"),
      toolTurn("load_skill", "call-2"),
      textTurn("I could not load that skill."),
    ]);

    mocks.handleToolCalls
      .mockResolvedValueOnce([
        { role: "tool", name: "load_skill", content: "skill is required", status: "error" },
      ])
      .mockResolvedValueOnce([
        {
          role: "tool",
          name: "load_skill",
          content: "call already repeated",
          status: "error",
          data: { errorCode: "REPEATED_TOOL_CALL" },
        },
      ]);

    const result = await runAgentLoop(params);

    expect(result.response.response).toBe("I could not load that skill.");
    expect(runTurn.mock.calls[2][0].request.disable_functions).toBe(true);
  });

  it("answers with what it has when the step budget runs out, rather than failing the turn", async () => {
    const { params, runTurn } = createParams(
      [toolTurn("get_weather"), toolTurn("get_weather"), textTurn("Here is what I found.")],
      2,
    );

    mocks.handleToolCalls.mockResolvedValue([
      { role: "tool", name: "get_weather", content: "sunny", status: "success" },
    ]);

    const result = await runAgentLoop(params);

    expect(result.response.response).toBe("Here is what I found.");
    expect(runTurn).toHaveBeenCalledTimes(3);

    const finalRequest = runTurn.mock.calls[2][0].request;

    expect(finalRequest.disable_functions).toBe(true);
    expect(finalRequest.messages.at(-1)).toMatchObject({ role: "user" });
  });

  it("gives up on a turn the provider could not deliver", async () => {
    const { params } = createParams([{ content: "", toolCalls: [], error: { message: "boom" } }]);

    await expect(runAgentLoop(params)).rejects.toThrow("boom");
  });
});
