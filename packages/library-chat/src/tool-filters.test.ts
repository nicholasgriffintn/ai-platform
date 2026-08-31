import type { Tool } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getSelectedCatalogToolIds } from "./tool-filters";

describe("tool catalogue selection", () => {
  it("does not count selected native model tools as selected function tools", () => {
    const tools: Tool[] = [
      {
        id: "load_skill",
        name: "Load Skill",
        description: "Load skill instructions.",
        category: "Other",
      },
    ];

    expect(
      getSelectedCatalogToolIds(tools, ["load_skill", "code_execution", "tool_search"]),
    ).toEqual(["load_skill"]);
  });
});
