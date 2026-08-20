import { describe, expect, it } from "vitest";

import type { Message } from "./conversation-types";
import {
  applyStreamActivityState,
  applyStreamActivityText,
  completeStreamActivityTool,
  createStreamActivity,
  estimateStreamActivityTokens,
  formatStatsDuration,
  formatStatsTokens,
  getMessageStatsSegments,
  getRunningStreamActivityTools,
  getStreamActivityMetrics,
} from "./response-stats";

function assistantMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    role: "assistant",
    content: "hello",
    ...overrides,
  };
}

describe("stream activity", () => {
  it("tracks tool runs from stream state events", () => {
    let activity = createStreamActivity(0);

    activity = applyStreamActivityState(
      activity,
      "tool_use_start",
      { tool_id: "call_1", tool_name: "web_search" },
      1000,
    );
    activity = applyStreamActivityState(
      activity,
      "tool_use_start",
      { tool_id: "call_2", tool_name: "get_weather" },
      1200,
    );

    expect(getRunningStreamActivityTools(activity).map((tool) => tool.name)).toEqual([
      "web_search",
      "get_weather",
    ]);

    activity = completeStreamActivityTool(activity, { toolCallId: "call_2" }, 2000);

    expect(getRunningStreamActivityTools(activity).map((tool) => tool.name)).toEqual([
      "web_search",
    ]);
    expect(activity.tools[1].completedAt).toBe(2000);
  });

  it("ignores repeated tool starts for the same tool id", () => {
    let activity = createStreamActivity(0);
    const event = { tool_id: "call_1", tool_name: "web_search" };

    activity = applyStreamActivityState(activity, "tool_use_start", event, 100);
    activity = applyStreamActivityState(activity, "tool_use_start", event, 150);

    expect(activity.tools).toHaveLength(1);
  });

  it("completes a tool by name when the result has no call id", () => {
    let activity = createStreamActivity(0);

    activity = applyStreamActivityState(
      activity,
      "tool_use_start",
      { tool_id: "call_1", tool_name: "web_search" },
      100,
    );
    activity = completeStreamActivityTool(activity, { name: "web_search" }, 400);

    expect(getRunningStreamActivityTools(activity)).toHaveLength(0);
  });

  it("completes every running tool once post processing starts", () => {
    let activity = createStreamActivity(0);

    activity = applyStreamActivityState(
      activity,
      "tool_use_start",
      { tool_id: "call_1", tool_name: "web_search" },
      100,
    );
    activity = applyStreamActivityState(activity, "post_processing", undefined, 900);

    expect(getRunningStreamActivityTools(activity)).toHaveLength(0);
  });

  it("estimates tokens from streamed content and reasoning", () => {
    let activity = createStreamActivity(0);

    activity = applyStreamActivityText(activity, {
      content: "a".repeat(400),
      reasoning: "b".repeat(400),
    });

    expect(estimateStreamActivityTokens(activity)).toBe(200);
  });

  it("never lets accumulated counts move backwards", () => {
    let activity = createStreamActivity(0);

    activity = applyStreamActivityText(activity, { content: "a".repeat(80) });
    activity = applyStreamActivityText(activity, { content: "a".repeat(20) });

    expect(activity.contentChars).toBe(80);
  });

  it("builds a metrics line with elapsed time, tokens, and tool activity", () => {
    let activity = createStreamActivity(0);

    activity = applyStreamActivityText(activity, { content: "a".repeat(4000) });
    activity = applyStreamActivityState(
      activity,
      "tool_use_start",
      { tool_id: "call_1", tool_name: "web_search" },
      1000,
    );

    expect(getStreamActivityMetrics(activity, 197_000)).toEqual([
      "3m 17s",
      "~1.0k tokens",
      "web_search running",
    ]);

    activity = completeStreamActivityTool(activity, { toolCallId: "call_1" }, 2000);

    expect(getStreamActivityMetrics(activity, 12_000)).toEqual(["12s", "~1.0k tokens", "1 tool"]);
  });
});

describe("stats formatting", () => {
  it("formats durations at second, minute, and hour scale", () => {
    expect(formatStatsDuration(0)).toBe("0s");
    expect(formatStatsDuration(1400)).toBe("1.4s");
    expect(formatStatsDuration(42_000)).toBe("42s");
    expect(formatStatsDuration(197_000)).toBe("3m 17s");
    expect(formatStatsDuration(3_900_000)).toBe("1h 5m");
  });

  it("formats token counts compactly", () => {
    expect(formatStatsTokens(820)).toBe("820");
    expect(formatStatsTokens(2740)).toBe("2.7k");
    expect(formatStatsTokens(24_800)).toBe("25k");
    expect(formatStatsTokens(1_400_000)).toBe("1.4m");
  });
});

describe("message stats", () => {
  it("summarises duration, tokens, tools, and cost", () => {
    const segments = getMessageStatsSegments(
      assistantMessage({
        usage: { prompt_tokens: 900, completion_tokens: 500, cost_usd: 0.0123 },
        tool_calls: [{ function: { name: "web_search", arguments: "{}" } }],
      }),
      12_400,
    );

    expect(segments).toEqual(["12s", "1.4k tokens", "1 tool", "$0.012"]);
  });

  it("falls back to provider specific usage fields", () => {
    const segments = getMessageStatsSegments(
      assistantMessage({ usage: { totalTokenCount: 2740 } }),
      undefined,
    );

    expect(segments).toEqual(["2.7k tokens"]);
  });

  it("returns nothing when the message carries no usage or tools", () => {
    expect(getMessageStatsSegments(assistantMessage())).toEqual([]);
  });
});
