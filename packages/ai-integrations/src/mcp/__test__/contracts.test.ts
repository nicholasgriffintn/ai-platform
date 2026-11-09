import { describe, expect, it } from "vitest";

import { readMcpToolAppEntry, type McpTool } from "../contracts.js";

const entryTool: McpTool = {
  name: "open_board",
  title: "Board",
  description: "A live board.",
  inputSchema: { type: "object", properties: { filter: { type: "string" } } },
  annotations: { readOnlyHint: true },
  _meta: { ui: { resourceUri: "ui://board/view" }, "app.polychat/app": {} },
};

describe("readMcpToolAppEntry", () => {
  it("reads a standalone app from a read-only tool with a view and the Polychat marker", () => {
    expect(readMcpToolAppEntry(entryTool)).toEqual({
      tool: "open_board",
      resourceUri: "ui://board/view",
      name: "Board",
      description: "A live board.",
      layout: "workspace",
    });
  });

  it("reads the marker's presentation fields and accepts a lower-case category", () => {
    expect(
      readMcpToolAppEntry({
        ...entryTool,
        _meta: {
          "ui/resourceUri": "ui://board/view",
          "app.polychat/app": {
            name: "Pin board",
            description: "Pins.",
            category: "play",
            icon: "puzzle",
            theme: "rose",
            when: "You want your pins.",
            uses: "Your board.",
            produces: "Nothing new.",
            surface: "contained",
          },
        },
      }),
    ).toEqual({
      tool: "open_board",
      resourceUri: "ui://board/view",
      name: "Pin board",
      description: "Pins.",
      category: "Play",
      icon: "puzzle",
      theme: "rose",
      when: "You want your pins.",
      uses: "Your board.",
      produces: "Nothing new.",
      layout: "contained",
    });
  });

  it("drops invalid fields to their defaults instead of hiding the app", () => {
    expect(
      readMcpToolAppEntry({
        ...entryTool,
        _meta: {
          ...entryTool._meta,
          "app.polychat/app": {
            category: "Games",
            icon: "http://board.example/icon.png",
            theme: "neon",
            layout: "floating",
            when: 42,
          },
        },
      }),
    ).toEqual({
      tool: "open_board",
      resourceUri: "ui://board/view",
      name: "Board",
      description: "A live board.",
      layout: "workspace",
    });
  });

  it("accepts an https icon URL and the legacy layout field", () => {
    expect(
      readMcpToolAppEntry({
        ...entryTool,
        _meta: {
          ...entryTool._meta,
          "app.polychat/app": { icon: "https://board.example/icon.png", layout: "contained" },
        },
      }),
    ).toMatchObject({ icon: "https://board.example/icon.png", layout: "contained" });
  });

  it.each<[string, McpTool]>([
    ["has no marker", { ...entryTool, _meta: { ui: { resourceUri: "ui://board/view" } } }],
    [
      "has a marker that is not an object",
      { ...entryTool, _meta: { ...entryTool._meta, "app.polychat/app": true } },
    ],
    [
      "has no ui:// view",
      {
        ...entryTool,
        _meta: { ui: { resourceUri: "https://board.example/view" }, "app.polychat/app": {} },
      },
    ],
    ["is not marked read-only", { ...entryTool, annotations: { readOnlyHint: false } }],
    ["leaves read-only unstated", { ...entryTool, annotations: {} }],
    [
      "needs arguments to open",
      { ...entryTool, inputSchema: { type: "object", required: ["filter"] } },
    ],
  ])("ignores a tool that %s", (_case, tool) => {
    expect(readMcpToolAppEntry(tool)).toBeUndefined();
  });
});
