import { describe, expect, it } from "vitest";

import {
  appendRecentNote,
  MEMORY_APPEND_CHARACTERS,
  shouldAppendMemory,
  splitRecentNotes,
} from "../notes";

describe("recently noted memories", () => {
  it("rewrites small settled documents and appends to large or pending ones", () => {
    expect(shouldAppendMemory("# Writing\n\nPrefers British English.")).toBe(false);
    expect(shouldAppendMemory("x".repeat(MEMORY_APPEND_CHARACTERS))).toBe(true);
    expect(shouldAppendMemory(appendRecentNote("# Writing", "Likes dashes", "2026-10-26"))).toBe(
      true,
    );
  });

  it("keeps every appended note and gives them back for consolidation", () => {
    const once = appendRecentNote(
      "# Writing\n\nPrefers British English.",
      "Likes  dashes",
      "2026-10-26",
    );
    const twice = appendRecentNote(once, "Avoids semicolons", "2026-10-27");

    expect(splitRecentNotes(twice)).toEqual({
      body: "# Writing\n\nPrefers British English.",
      notes: "- 2026-10-26: Likes dashes\n- 2026-10-27: Avoids semicolons",
    });
    expect(splitRecentNotes("# Writing")).toEqual({ body: "# Writing", notes: "" });
  });
});
