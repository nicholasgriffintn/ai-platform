import { describe, expect, it } from "vitest";

import { importedMemoryNotes } from "~/modules/memory-documents/application/import-batches";

describe("memory import batches", () => {
  it("keeps only memories whose quotes appear in the cited message", () => {
    const batch = [
      { id: "m0", text: "I'm vegetarian and allergic to cashews.", conversationTitle: "Dinner" },
      { id: "m1", text: "Book the table for Friday." },
    ];

    const notes = importedMemoryNotes(
      {
        memories: [
          {
            text: "The user is vegetarian and allergic to cashews.",
            evidence: [{ messageId: "m0", quote: "allergic to cashews" }],
          },
          {
            text: "The user prefers window seats.",
            evidence: [{ messageId: "m1", quote: "window seat" }],
          },
          {
            text: "The user is vegetarian.",
            evidence: [{ messageId: "m9", quote: "vegetarian" }],
          },
        ],
      },
      batch,
      "claude",
    );

    expect(notes).toEqual([
      {
        text: "The user is vegetarian and allergic to cashews.",
        evidence: [
          {
            origin: "import",
            source: "claude",
            conversationTitle: "Dinner",
            quote: "allergic to cashews",
          },
        ],
      },
    ]);
  });
});
