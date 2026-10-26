import { describe, expect, it } from "vitest";

import { withReservedKnowledgeMetadata } from "../envelope";

describe("withReservedKnowledgeMetadata", () => {
  it("keeps stored pipeline keys and drops ones a client tries to set", () => {
    expect(
      withReservedKnowledgeMetadata(
        {
          note: true,
          body: { key: "knowledge/bodies/other/x.txt", characters: 1, hash: "h" },
          origin: "upload",
          syncId: "forged",
        },
        { origin: "note", enrichments: { summary: { status: "done" } } },
      ),
    ).toEqual({ note: true, origin: "note", enrichments: { summary: { status: "done" } } });
  });
});
