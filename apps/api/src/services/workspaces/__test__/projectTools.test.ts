import { describe, expect, it } from "vitest";

import { resolveProjectTools, validateProjectToolConfiguration } from "../projectTools";

describe("project tool configuration", () => {
  it("rejects incomplete configuration for tools marked as requiring it", () => {
    expect(() => validateProjectToolConfiguration("file_search", {})).toThrow(
      "File search configuration is incomplete",
    );
    expect(() =>
      validateProjectToolConfiguration("mcp", {
        servers: [{ label: "Internal", url: "http://localhost:8787/mcp" }],
      }),
    ).toThrow("MCP configuration is incomplete");
  });

  it("does not accept arbitrary tool identifiers or configuration", () => {
    expect(() => validateProjectToolConfiguration("unknown", {})).toThrow("Unknown project tool");
    expect(validateProjectToolConfiguration("web_fetch", { unexpected: true })).toEqual({});
  });

  it("enables selected callable tools from the project capability library", () => {
    expect(validateProjectToolConfiguration("get_weather", { unexpected: true })).toEqual({});

    expect(
      resolveProjectTools([
        {
          id: "capability-1",
          project_id: "project-1",
          kind: "tool",
          capability_id: "get_weather",
          configuration: {},
          created_by: 1,
          created_at: "2026-08-11T00:00:00.000Z",
        },
      ]),
    ).toMatchObject({
      enabledTools: expect.arrayContaining(["get_weather"]),
    });
  });
});
