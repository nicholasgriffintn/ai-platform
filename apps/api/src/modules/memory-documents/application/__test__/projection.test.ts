import { estimateTextTokens } from "@ngriffin_uk/polychat-ai-providers";
import { describe, expect, it } from "vitest";

import { projectRunMemory } from "~/modules/memory-documents/application/projection";

import { memoryDocumentFixture } from "../../../../../test/fixtures/native-memory";

describe("native memory projection and bounded retrieval", () => {
  it("keeps essential memory and makes references discoverable without loading their body", () => {
    const core = memoryDocumentFixture();
    const reference = memoryDocumentFixture({
      id: "reference",
      name: "research",
      tier: "reference",
      summary: "Long research notes",
      content: "Large private research body".repeat(1000),
    });
    const result = projectRunMemory(
      [
        { document: reference, access: "read" },
        { document: core, access: "read-write" },
      ],
      2000,
    );

    expect(result.section).toContain(core.content);
    expect(result.section).toContain("Long research notes");
    expect(result.section).not.toContain(reference.content);
    expect(result.documents.map((item) => item.status)).toEqual(["included", "deferred"]);
    expect(result.tokens).toBeLessThanOrEqual(2000);
  });

  it("defers oversized core documents intact and counts all rendered index overhead", () => {
    const oversized = memoryDocumentFixture({ content: "Important decision ".repeat(5000) });
    const result = projectRunMemory([{ document: oversized, access: "read" }], 700);

    expect(result.documents[0]).toMatchObject({ status: "deferred", reason: "budget" });
    expect(result.tokens).toBe(estimateTextTokens(result.section));
    expect(result.tokens).toBeLessThanOrEqual(700);
    expect(result.section).not.toContain(oversized.content);
    expect(projectRunMemory([{ document: oversized, access: "read" }], 0)).toMatchObject({
      section: "",
      tokens: 0,
      documents: [{ status: "omitted" }],
    });
  });
});
