import { beforeEach, describe, expect, it } from "vitest";

import { useStreamActivityStore } from "./streamActivityStore";

describe("streamActivityStore", () => {
  beforeEach(() => {
    useStreamActivityStore.setState({
      streams: {},
      responseDurations: {},
    });
  });

  it("keeps simultaneous stream state isolated by conversation", () => {
    const firstController = new AbortController();
    const secondController = new AbortController();
    const store = useStreamActivityStore.getState();

    store.beginStreamActivity("conversation-1", firstController);
    store.beginStreamActivity("conversation-2", secondController);
    store.endStreamActivity("conversation-1");

    expect(useStreamActivityStore.getState().streams["conversation-1"]).toBeUndefined();
    expect(useStreamActivityStore.getState().streams["conversation-2"]).toMatchObject({
      controller: secondController,
      status: "streaming",
    });
  });

  it("keeps an action marker after a stream finishes", () => {
    const store = useStreamActivityStore.getState();

    store.beginStreamActivity("conversation-1", new AbortController());
    store.recordStreamActivityToolResult("conversation-1", {
      name: "ask_user",
      status: "pending",
      toolCallId: "question-1",
    });
    store.endStreamActivity("conversation-1");

    expect(useStreamActivityStore.getState().streams["conversation-1"]).toMatchObject({
      status: "action-required",
    });
  });

  it("projects canonical activity independently for each conversation", () => {
    const store = useStreamActivityStore.getState();

    store.beginStreamActivity("conversation-1");
    store.beginStreamActivity("conversation-2");
    store.recordTurnActivity("conversation-1", {
      type: "turn_activity",
      kind: "reasoning_started",
      step: 1,
    });

    expect(useStreamActivityStore.getState().streams["conversation-1"]).toMatchObject({
      loadingMessage: "Reasoning...",
      turnActivity: { phase: "reasoning", step: 1 },
    });
    expect(useStreamActivityStore.getState().streams["conversation-2"]).toMatchObject({
      loadingMessage: "Generating response...",
      turnActivity: null,
    });
  });

  it("preserves semantic context while detached recovery reconnects", () => {
    const store = useStreamActivityStore.getState();

    store.beginStreamActivity("conversation-1");
    store.recordTurnActivity("conversation-1", {
      type: "turn_activity",
      kind: "tool_execution_started",
      step: 1,
      toolCallId: "call-weather",
      toolName: "weather",
    });
    store.markStreamActivityReconnecting("conversation-1");

    expect(useStreamActivityStore.getState().streams["conversation-1"]).toMatchObject({
      loadingMessage: "Reconnecting to the response...",
      turnActivity: {
        phase: "reconnecting",
        tools: [{ id: "call-weather", name: "weather", status: "running" }],
      },
    });
  });
});
