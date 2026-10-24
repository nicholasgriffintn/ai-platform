import { describe, expect, it } from "vitest";

import { noteFromReply, readSourceCitationId } from "./notebooks";

describe("notebook replies and citations", () => {
  it("titles a saved reply from its first line without Markdown", () => {
    expect(noteFromReply("- **Revenue:** up 18 per cent\n- Churn: 2.1 per cent").title).toBe(
      "Revenue: up 18 per cent",
    );
    expect(noteFromReply("## Launch risks\nTablet layout").title).toBe("Launch risks");
  });

  it("only treats notebook source links as citations", () => {
    expect(readSourceCitationId("#source-seed%20source")).toBe("seed source");
    expect(readSourceCitationId("#seed-source-quarterly-review")).toBeNull();
    expect(readSourceCitationId("https://example.com")).toBeNull();
  });
});
