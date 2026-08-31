import { describe, expect, it } from "vitest";

import { mergeRealtimeTranscriptText } from "./transcript-text";

describe("realtime transcript text", () => {
  it("replaces cumulative interim snapshots instead of concatenating them", () => {
    const first = mergeRealtimeTranscriptText("", {
      isDelta: false,
      text: "Good",
    });
    const second = mergeRealtimeTranscriptText(first, {
      isDelta: false,
      text: "Good morning",
    });

    expect(second).toBe("Good morning");
  });

  it("appends incremental transcript deltas", () => {
    expect(
      mergeRealtimeTranscriptText("Good", {
        isDelta: true,
        text: " morning",
      }),
    ).toBe("Good morning");
  });
});
