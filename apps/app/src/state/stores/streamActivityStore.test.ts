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
});
