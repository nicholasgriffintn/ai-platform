import { describe, expect, it } from "vitest";

import { parseResearchDocument } from "../research";

describe("parseResearchDocument", () => {
  it("reads a snippet written as page markup back as plain words", () => {
    const [section] = parseResearchDocument(
      "## 2026-10-25\n- [A story](https://example.com/a) _(example.com · 2026-10-25)_ — [![Logo](https://example.com/logo.svg)](/) [Skip to content](#main) **Bold** claim about *things*.",
    );

    expect(section?.results[0]?.snippet).toBe("Skip to content Bold claim about things.");
  });
});
