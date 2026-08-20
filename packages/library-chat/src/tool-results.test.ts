import { describe, expect, it } from "vitest";

import type { Message } from "./conversation-types";
import { resolveToolMessageDisplay, resolveToolResultPartDisplay } from "./tool-results";

type ToolResultPart = Extract<NonNullable<Message["parts"]>[number], { type: "tool_result" }>;

describe("resolveToolResultPartDisplay", () => {
  it("carries the presentation metadata the API attached, for any tool", () => {
    const part = {
      type: "tool_result",
      name: "mcp_linear_search_issues",
      status: "success",
      content: "Found 3 issues",
      data: {
        renderer: "issue_list",
        icon: "search",
        formattedName: "Linear issues",
        responseType: "table",
        responseDisplay: { fields: [{ key: "id", label: "ID" }] },
        issues: [],
      },
    } as unknown as ToolResultPart;

    const display = resolveToolResultPartDisplay(part);

    expect(display).toMatchObject({
      name: "mcp_linear_search_issues",
      label: "Linear issues",
      icon: "search",
      renderer: "issue_list",
      responseType: "table",
      status: "success",
    });
    expect(display.result.content).toBe("Found 3 issues");
  });

  it("falls back to a humanised tool name when the API supplied no label", () => {
    const part = {
      type: "tool_result",
      name: "get_hacker_news_stories",
      content: "",
    } as unknown as ToolResultPart;

    expect(resolveToolResultPartDisplay(part).label).toBe("Get Hacker News Stories");
  });

  it("serialises structured content so a non-string payload still reaches the renderer", () => {
    const part = {
      type: "tool_result",
      name: "call_api",
      content: { ok: true },
    } as unknown as ToolResultPart;

    expect(resolveToolResultPartDisplay(part).result.content).toBe('{\n  "ok": true\n}');
  });
});

describe("resolveToolMessageDisplay", () => {
  it("produces the same shape from a legacy role:tool message", () => {
    const message = {
      id: "tool-1",
      role: "tool",
      name: "get_weather",
      status: "success",
      content: "Sunny",
      data: { renderer: "weather", icon: "cloud", formattedName: "Get Weather" },
    } as unknown as Message;

    expect(resolveToolMessageDisplay(message)).toMatchObject({
      name: "get_weather",
      label: "Get Weather",
      icon: "cloud",
      renderer: "weather",
      status: "success",
    });
  });
});
