import { describe, expect, it } from "vitest";

import { createResponseEventProjector, createResponseStreamAssembler } from "./stream.js";

const run = {
  protocolVersion: 1,
  id: "run_1",
  conversationId: "conv_1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 7,
  trigger: "user",
  status: "running",
  attempt: 1,
  createdAt: "2026-10-13T10:00:00.000Z",
  updatedAt: "2026-10-13T10:00:00.000Z",
  startedAt: "2026-10-13T10:00:00.000Z",
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
};

const receipt = {
  protocolVersion: 1,
  commandId: "cmd_1",
  run,
  kind: "turn",
  acceptedAt: "2026-10-13T10:00:00.000Z",
  duplicate: false,
};

describe("response stream", () => {
  it("projects an engine turn onto sequenced platform events the assembler rebuilds", () => {
    const projector = createResponseEventProjector({ conversationId: "conv_1" });
    const now = () => 1_000;
    const assembler = createResponseStreamAssembler({ model: "gpt", now, createId: () => "gen" });
    const events = [
      ...projector.project("state", { state: "run", receipt }),
      ...projector.project("turn_activity", { kind: "turn_started" }),
      ...projector.project("state", { state: "init" }),
      ...projector.project("usage_limits", { usage_limits: { remaining: 10 } }),
      ...projector.project("message_start", {
        id: "conv_1",
        message_id: "msg_1",
        created: 5,
        model: "gpt",
        provider: "openai",
        platform: "web",
      }),
      ...projector.project("content_block_delta", { content: "Hel" }),
      ...projector.project("content_block_delta", { content: "lo" }),
      ...projector.project("tool_use_start", { tool_id: "call_1", tool_name: "get_weather" }),
      ...projector.project("tool_use_delta", { tool_id: "call_1", parameters: '{"city":' }),
      ...projector.project("tool_use_delta", { tool_id: "call_1", parameters: '"Leeds"}' }),
      ...projector.project("tool_use_stop", { tool_id: "call_1" }),
      ...projector.project("tool_response", {
        result: {
          id: "tool_1",
          role: "tool",
          name: "get_weather",
          content: "12C",
          status: "success",
          tool_call_id: "call_1",
        },
      }),
      ...projector.project("tool_response_end", {}),
      ...projector.project("message_delta", {
        id: "conv_1",
        message_id: "msg_1",
        content: "Hello",
        usage: { total_tokens: 3 },
        log_id: "log_1",
        finish_reason: "stop",
      }),
      ...projector.project("message_stop", {}),
      ...projector.project("state", {
        state: "run",
        receipt: { ...receipt, run: { ...run, status: "succeeded" } },
      }),
      ...projector.project("state", { state: "done" }),
    ];

    expect(events.map((event) => event.sequence_number)).toEqual(events.map((_, index) => index));
    expect(events.every((event) => event.response_id === "run_1")).toBe(true);
    expect(events.map((event) => event.type)).toEqual([
      "response.created",
      "response.activity",
      "response.phase",
      "response.usage_limits",
      "response.output_item.added",
      "response.output_text.delta",
      "response.output_text.delta",
      "response.output_item.added",
      "response.tool_call.arguments.delta",
      "response.tool_call.arguments.delta",
      "response.output_item.done",
      "response.output_item.done",
      "response.tool_outputs.done",
      "response.output_item.done",
      "response.content_part.done",
      "response.completed",
      "response.phase",
    ]);

    const updates = events.flatMap((event) => assembler.ingest(event));
    const final = assembler.getFinalMessage();

    expect(updates[0]).toMatchObject({ type: "response", event: "response.created" });
    expect(updates.find((update) => update.type === "tool_call_started")).toMatchObject({
      toolCallId: "call_1",
      toolName: "get_weather",
    });
    expect(updates.find((update) => update.type === "tool_result")).toMatchObject({
      message: { role: "tool", id: "tool_1", content: "12C", tool_call_id: "call_1" },
    });
    expect(final).toMatchObject({
      id: "msg_1",
      role: "assistant",
      content: "Hello",
      model: "gpt",
      provider: "openai",
      log_id: "log_1",
      usage: { total_tokens: 3 },
      tool_calls: [
        { id: "call_1", function: { name: "get_weather", arguments: { city: "Leeds" } } },
      ],
    });
    expect(assembler.getResponse()).toMatchObject({ id: "run_1", status: "completed" });
  });

  it("synthesises a message item when text arrives before message_start", () => {
    const projector = createResponseEventProjector({ createId: () => "synthetic" });
    const events = projector.project("content_block_delta", { content: "Hi" });

    expect(events.map((event) => event.type)).toEqual([
      "response.output_item.added",
      "response.output_text.delta",
    ]);
    expect(events[1]).toMatchObject({ item_id: "synthetic", delta: "Hi" });
  });

  it("surfaces engine errors as response.error", () => {
    const projector = createResponseEventProjector();
    const assembler = createResponseStreamAssembler();
    const [event] = projector.project("error", {
      error: { message: "boom" },
      type: "PROVIDER_ERROR",
    });

    expect(assembler.ingest(event)).toEqual([
      { type: "error", error: { message: "boom" }, code: "PROVIDER_ERROR" },
    ]);
  });
});
