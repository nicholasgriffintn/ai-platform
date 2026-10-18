import { describe, expect, it } from "vitest";

import { buildSkillHarvestTrace, wasThumbedDown } from "./skill-harvest.js";

const tool = (name: string, status = "success") => ({
  role: "tool",
  name,
  status,
  tool_call_arguments: JSON.stringify({ query: "x", limit: 5 }),
});

describe("skill harvest traces", () => {
  it("needs a request, enough successful tool calls and a reply", () => {
    expect(
      buildSkillHarvestTrace([
        { role: "user", content: "Tidy my inbox" },
        tool("search"),
        tool("search"),
        { role: "assistant", content: "Done" },
      ]),
    ).toBeNull();

    const trace = buildSkillHarvestTrace([
      { role: "user", content: "Tidy my inbox" },
      tool("list_mail"),
      tool("archive", "error"),
      tool("archive"),
      tool("archive"),
      tool("label"),
      tool("label"),
      { role: "assistant", content: "Archived 12 and labelled 3." },
    ]);

    expect(trace?.steps.map((step) => step.tool)).toEqual([
      "list_mail",
      "archive",
      "archive",
      "label",
      "label",
    ]);
    expect(trace?.steps[0]?.argumentNames).toEqual(["query", "limit"]);
    expect(trace?.outcome).toBe("Archived 12 and labelled 3.");
  });

  it("notices a thumbs down from the person", () => {
    expect(
      wasThumbedDown([
        {
          role: "assistant",
          content: "Done",
          data: {
            reactions: [
              { emoji: "👎", actor: "person", actor_id: "1", created_at: "2026-10-18T00:00:00Z" },
            ],
          },
        },
      ]),
    ).toBe(true);
    expect(wasThumbedDown([{ role: "assistant", content: "Done" }])).toBe(false);
  });
});
