import { describe, expect, it } from "vitest";

import {
  batchMemoryImport,
  importedMemoryNotes,
  packMemoryImport,
  readMemoryImportBatch,
} from "~/modules/memory-documents/application/import-batches";

describe("memory import batches", () => {
  it("splits messages across batches and reads each back from its byte range", () => {
    const { batches, messages } = batchMemoryImport(
      {
        kind: "conversations",
        source: "chatgpt",
        conversations: [
          {
            title: "Café plans",
            createdAt: "2024-03-02T10:00:00.000Z",
            messages: [
              { text: "I run a café in Leeds — it opens at seven." },
              { text: "My partner Sam handles the books." },
              { text: "   " },
            ],
          },
        ],
      },
      20,
    );
    const { body, offsets } = packMemoryImport(batches);
    const bytes = new TextEncoder().encode(body);
    const decoded = batches.map((_, index) =>
      readMemoryImportBatch(
        new TextDecoder().decode(bytes.slice(offsets[index], offsets[index + 1])),
      ),
    );

    expect(messages).toBe(2);
    expect(batches).toHaveLength(2);
    expect(decoded).toEqual(batches);
    expect(decoded[0][0]).toMatchObject({
      id: "m0",
      conversationTitle: "Café plans",
      occurredAt: "2024-03-02T10:00:00.000Z",
    });
  });

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
