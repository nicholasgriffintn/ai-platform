// @vitest-environment node

import { describe, expect, it } from "vitest";

import { NEW_NOTE_TITLE, noteEditorText, splitNoteText } from "../note-text.js";

describe("note text", () => {
  it("round-trips a titled note through the editor", () => {
    const text = noteEditorText({ title: "Shopping", content: "eggs\nmilk", revision: 3 });

    expect(text).toBe("Shopping\neggs\nmilk");
    expect(splitNoteText(text)).toEqual({ title: "Shopping", content: "eggs\nmilk" });
  });

  it("opens a blank new note empty and keeps its placeholder title until a line is written", () => {
    expect(noteEditorText({ title: NEW_NOTE_TITLE, content: "", revision: 1 })).toBe("");
    expect(splitNoteText("\n  body without a heading")).toEqual({
      title: NEW_NOTE_TITLE,
      content: "  body without a heading",
    });
  });

  it("caps the title at what a file name can hold", () => {
    expect(splitNoteText(`${"a".repeat(260)}\nbody`).title).toHaveLength(200);
  });
});
