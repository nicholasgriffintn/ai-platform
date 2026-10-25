import { describe, expect, it } from "vitest";

import { parseResearchDocument } from "../research";

describe("parseResearchDocument", () => {
  it("drops a stored snippet that is only page chrome", () => {
    const [section] = parseResearchDocument(
      "## 2026-10-25\n- [A story](https://example.com/a) _(example.com · 2026-10-25)_ — [![Logo](https://example.com/logo.svg)](/) [Skip to content](#main) **Bold** claim about *things*.",
    );

    expect(section?.results[0]?.snippet).toBe("");
  });

  it("keeps a short plain sentence as it was written", () => {
    const [section] = parseResearchDocument(
      "## 2026-10-25\n- [A story](https://example.com/a) — Charli XCX joins Scorsese's next film.",
    );

    expect(section?.results[0]?.snippet).toBe("Charli XCX joins Scorsese's next film.");
  });
});
