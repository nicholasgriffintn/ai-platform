import { describe, expect, it } from "vitest";

import { channelSignalReactions } from "../reaction-signals";

describe("channel reaction signals", () => {
  it("stays silent when reactions are off", () => {
    expect(channelSignalReactions("off", "picked_up")).toEqual([]);
    expect(channelSignalReactions("off", "failed")).toEqual([]);
  });

  it("clears the acknowledgement when done and only marks done at full", () => {
    expect(channelSignalReactions("ack", "done")).toEqual([{ emoji: "👀", remove: true }]);
    expect(channelSignalReactions("full", "done")).toEqual([
      { emoji: "👀", remove: true },
      { emoji: "✅" },
    ]);
  });

  it("swaps the acknowledgement for a warning when the run fails", () => {
    expect(channelSignalReactions("ack", "failed")).toEqual([
      { emoji: "👀", remove: true },
      { emoji: "⚠️" },
    ]);
  });
});
