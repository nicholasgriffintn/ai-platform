import { describe, expect, it } from "vitest";

import {
  applyTurnActivityEvent,
  createTurnActivityProjection,
  markTurnActivityReconnecting,
} from "./turn-activity";

describe("turn activity projection", () => {
  it("projects model preparation, reasoning and response generation", () => {
    let projection = createTurnActivityProjection();

    projection = applyTurnActivityEvent(projection, {
      type: "turn_activity",
      kind: "model_step_started",
      step: 1,
    });
    expect(projection).toMatchObject({ phase: "preparing", step: 1 });

    projection = applyTurnActivityEvent(projection, {
      type: "turn_activity",
      kind: "reasoning_started",
      step: 1,
    });
    expect(projection).toMatchObject({ phase: "reasoning", label: "Reasoning..." });

    projection = applyTurnActivityEvent(projection, {
      type: "turn_activity",
      kind: "response_started",
      step: 1,
    });
    expect(projection).toMatchObject({
      phase: "generating",
      label: "Generating response...",
    });

    projection = applyTurnActivityEvent(projection, {
      type: "turn_activity",
      kind: "response_finished",
      step: 1,
    });
    expect(projection).toMatchObject({ phase: "finalising", label: "Finalising response..." });
  });

  it("tracks parallel tool execution and individual outcomes", () => {
    let projection = createTurnActivityProjection();

    for (const [toolCallId, toolName] of [
      ["call-weather", "weather"],
      ["call-clock", "clock"],
    ] as const) {
      projection = applyTurnActivityEvent(projection, {
        type: "turn_activity",
        kind: "tool_execution_started",
        step: 1,
        toolCallId,
        toolName,
      });
    }

    expect(projection).toMatchObject({
      phase: "using_tools",
      label: "Running 2 tools...",
      tools: [
        { id: "call-weather", status: "running" },
        { id: "call-clock", status: "running" },
      ],
    });

    projection = applyTurnActivityEvent(projection, {
      type: "turn_activity",
      kind: "tool_finished",
      step: 1,
      toolCallId: "call-weather",
      toolName: "weather",
      outcome: "failure",
    });
    expect(projection).toMatchObject({
      phase: "using_tools",
      label: "weather failed. Continuing...",
      tools: [
        { id: "call-weather", status: "failure" },
        { id: "call-clock", status: "running" },
      ],
    });

    projection = applyTurnActivityEvent(projection, {
      type: "turn_activity",
      kind: "tool_finished",
      step: 1,
      toolCallId: "call-clock",
      toolName: "clock",
      outcome: "success",
    });
    expect(projection).toMatchObject({ phase: "preparing", tools: expect.any(Array) });
  });

  it("preserves action context through waiting, reconnection and cancellation", () => {
    let projection = applyTurnActivityEvent(createTurnActivityProjection(), {
      type: "turn_activity",
      kind: "waiting_for_user",
      step: 2,
      toolCallId: "call-approval",
      toolName: "connector_write",
      reason: "approval",
    });

    expect(projection).toMatchObject({
      phase: "waiting",
      label: "Waiting for your approval.",
      requiresAction: true,
    });

    projection = markTurnActivityReconnecting(projection);
    expect(projection).toMatchObject({
      phase: "reconnecting",
      requiresAction: true,
      tools: [{ id: "call-approval", name: "connector_write" }],
    });

    projection = applyTurnActivityEvent(projection, {
      type: "turn_activity",
      kind: "turn_finished",
      outcome: "cancelled",
    });
    expect(projection).toMatchObject({ phase: "cancelled", label: "Response stopped." });
  });

  it("distinguishes a selection wait from a question or approval", () => {
    const projection = applyTurnActivityEvent(createTurnActivityProjection(), {
      type: "turn_activity",
      kind: "waiting_for_user",
      step: 1,
      toolCallId: "call-selection",
      toolName: "select_council_members",
      reason: "selection",
    });

    expect(projection).toMatchObject({
      phase: "waiting",
      label: "Waiting for your selection.",
      requiresAction: true,
    });
  });

  it("projects provider failure as a terminal state", () => {
    const projection = applyTurnActivityEvent(createTurnActivityProjection(), {
      type: "turn_activity",
      kind: "turn_finished",
      outcome: "failed",
      errorType: "PROVIDER_ERROR",
    });

    expect(projection).toMatchObject({ phase: "failed", label: "Response failed." });
  });
});
