import { describe, expect, it } from "vitest";

import type { Message } from "./conversation-types.js";
import { collectHandoffRuns, isCollapsedHandoffFollower } from "./handoffs.js";

function handoff(id: string, teammateId: string): Message {
  return { id, role: "assistant", content: "update", data: { trigger: "handle", teammateId } };
}

describe("handoff runs", () => {
  it("groups consecutive teammate handoffs and breaks on anything else", () => {
    const messages: Message[] = [
      handoff("a", "chief"),
      handoff("b", "accounts"),
      handoff("c", "chief"),
      { id: "d", role: "user", content: "thanks" },
      handoff("e", "accounts"),
    ];
    const runs = collectHandoffRuns(messages);

    expect(runs.get("c")).toMatchObject({
      leadMessageId: "a",
      teammateIds: ["chief", "accounts"],
      messageIds: ["a", "b", "c"],
    });
    expect(runs.get("e")?.leadMessageId).toBe("e");
    expect(runs.has("d")).toBe(false);
  });

  it("hides followers until the run is expanded, but never the lead", () => {
    const runs = collectHandoffRuns([handoff("a", "chief"), handoff("b", "chief")]);

    expect(isCollapsedHandoffFollower(runs, new Set(), "a")).toBe(false);
    expect(isCollapsedHandoffFollower(runs, new Set(), "b")).toBe(true);
    expect(isCollapsedHandoffFollower(runs, new Set(["a"]), "b")).toBe(false);
  });
});
