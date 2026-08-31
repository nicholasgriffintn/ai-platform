import { describe, expect, it } from "vitest";

import type { Message } from "./conversation-types";
import {
  applyToolInteractionResolutions,
  getResolvedToolUseIndexes,
  resolveToolMessageDisplay,
  resolveToolResultPartDisplay,
} from "./tool-results";

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
    expect(display.result?.content).toBe("Found 3 issues");
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

    expect(resolveToolResultPartDisplay(part).result?.content).toBe('{\n  "ok": true\n}');
  });

  it("renders historical tool search results as readable text", () => {
    const part = {
      type: "tool_result",
      name: "tool_search",
      content: [
        {
          name: "assistant_tools_4",
          description: "Assistant application tools",
        },
      ],
    } as unknown as ToolResultPart;

    expect(resolveToolResultPartDisplay(part)).toMatchObject({
      responseType: "text",
      result: { content: "assistant_tools_4 — Assistant application tools" },
    });
  });
});

describe("getResolvedToolUseIndexes", () => {
  it("pairs a provider tool result by name when its nullable call id was replaced", () => {
    const parts = [
      {
        type: "tool_use" as const,
        name: "tool_search",
        toolCallId: "tsc_1",
        input: { query: "news" },
      },
      {
        type: "tool_result" as const,
        name: "tool_search",
        toolCallId: "tso_1",
        status: "completed",
        content: "get_hacker_news_stories",
      },
    ];

    expect([...getResolvedToolUseIndexes(parts)]).toEqual([0]);
  });

  it("does not hide an unmatched pending call", () => {
    const parts = [
      { type: "tool_use" as const, name: "tool_search", toolCallId: "tsc_1" },
      { type: "tool_result" as const, name: "hosted_shell", toolCallId: "call_2" },
    ];

    expect([...getResolvedToolUseIndexes(parts)]).toEqual([]);
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

describe("applyToolInteractionResolutions", () => {
  it("projects a durable council selection onto the pending tool result", () => {
    const messages = [
      {
        id: "tool-1",
        role: "tool",
        name: "select_council_members",
        status: "pending",
        content: "Waiting for the user to choose the council.",
        data: {
          renderer: "council_member_picker",
          humanInTheLoop: {
            type: "selection",
            status: "pending",
            requires_user_action: true,
          },
        },
        parts: [
          {
            type: "tool_result",
            name: "select_council_members",
            status: "pending",
            content: "Waiting for the user to choose the council.",
            data: { renderer: "council_member_picker" },
          },
        ],
      },
      {
        id: "user-1",
        role: "user",
        content: "Convene the council with these members: Sceptic, Operator.",
        data: {
          toolInteraction: {
            toolName: "select_council_members",
            response: { memberIds: ["sceptic", "operator"] },
          },
        },
      },
    ] as Message[];

    const [resolved] = applyToolInteractionResolutions(messages);

    expect(resolved).toMatchObject({
      status: "completed",
      data: {
        resolved: true,
        resolution: { memberIds: ["sceptic", "operator"] },
        humanInTheLoop: {
          type: "selection",
          status: "resolved",
          requires_user_action: false,
        },
      },
      parts: [
        {
          type: "tool_result",
          status: "completed",
          data: {
            resolved: true,
            resolution: { memberIds: ["sceptic", "operator"] },
          },
        },
      ],
    });
    expect(messages[0].status).toBe("pending");
  });

  it("recovers the selection stored by council conversations created before structured resolutions", () => {
    const messages = [
      {
        id: "tool-1",
        role: "tool",
        name: "select_council_members",
        status: "pending",
        content: "Waiting for the user to choose the council.",
        data: {
          members: [
            { id: "strategist", name: "Strategist" },
            { id: "critic", name: "Critic" },
            { id: "joker", name: "Joker" },
          ],
        },
      },
      {
        id: "user-1",
        role: "user",
        content: "Convene the council with these members: Strategist, Critic, Joker.",
      },
    ] as Message[];

    expect(applyToolInteractionResolutions(messages)[0]).toMatchObject({
      status: "completed",
      data: {
        resolved: true,
        resolution: { memberIds: ["strategist", "critic", "joker"] },
      },
    });
  });

  it("leaves the tool result pending when a legacy selection names an unknown council member", () => {
    const messages = [
      {
        id: "tool-1",
        role: "tool",
        name: "select_council_members",
        status: "pending",
        content: "Waiting for the user to choose the council.",
        data: {
          members: [
            { id: "strategist", name: "Strategist" },
            { id: "critic", name: "Critic" },
            { id: "joker", name: "Joker" },
          ],
        },
      },
      {
        id: "user-1",
        role: "user",
        content: "Convene the council with these members: Strategist, Nobody, Joker.",
      },
    ] as Message[];

    const [resolved] = applyToolInteractionResolutions(messages);

    expect(resolved).toMatchObject({ status: "pending" });
    expect(resolved.data).not.toHaveProperty("resolved");
    expect(resolved.data).not.toHaveProperty("resolution");
  });
});
