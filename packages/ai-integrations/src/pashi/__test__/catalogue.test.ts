import { describe, expect, it } from "vitest";

import { getPashiToolFields, searchPashiTools } from "../catalogue.js";
import type { PashiTool } from "../contracts.js";

function tool(overrides: Partial<PashiTool> = {}): PashiTool {
  return {
    aliases: [],
    audience: "everyone",
    description: "Convert markdown",
    display: { actionLabel: "Convert", category: "docs", examples: [] },
    endpoint: "/api/markdown",
    id: "markdown",
    input: { mode: "text", label: "Markdown", required: true },
    label: "Markdown",
    status: "available",
    toolType: "converter",
    ...overrides,
  };
}

describe("Pashi catalogue", () => {
  it("adds the output format field a converter exposes", () => {
    const fields = getPashiToolFields(tool({ outputs: ["html", "pdf"] }));

    expect(fields).toEqual([
      { id: "outputFormat", label: "Output format", required: true, values: ["html", "pdf"] },
    ]);
  });

  it("filters by tool type and ranks exact names first", () => {
    const results = searchPashiTools({
      limit: 5,
      query: "markdown to jira",
      toolTypes: ["converter"],
      tools: [
        tool({ id: "other", label: "Other" }),
        tool({ id: "markdown-to-jira", label: "Markdown to Jira" }),
        tool({ id: "generator", label: "Generator", toolType: "generator" }),
      ],
    });

    expect(results.map((result) => result.id)).toEqual(["markdown-to-jira", "other"]);
  });
});
