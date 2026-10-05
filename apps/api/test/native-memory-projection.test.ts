import { estimateTextTokens } from "@ngriffin_uk/polychat-ai-providers";
import { describe, expect, it } from "vitest";

import {
  memoryDocumentPage,
  memorySearchPassage,
} from "~/modules/memory-documents/application/pages";
import { projectRunMemory } from "~/modules/memory-documents/application/projection";
import { applyMemoryReflectionProposal } from "~/modules/memory-documents/application/reflection-proposal";

import { memoryDocumentFixture } from "./native-memory";

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

  it("retrieves bounded matching passages and reconstructs a document from stable pages", () => {
    const document = memoryDocumentFixture({
      content: `${"İ".repeat(3999)}🚀${"x".repeat(3000)}needle${"y".repeat(7000)}`,
    });
    const result = memorySearchPassage(document, "needle");

    expect(result.text).toContain("needle");
    expect(result.text.length).toBeLessThan(1600);
    let offset = 0;
    let restored = "";

    do {
      const page = memoryDocumentPage(document, offset);

      expect(estimateTextTokens(page.content)).toBeLessThanOrEqual(2000);
      expect(new TextDecoder().decode(new TextEncoder().encode(page.content))).toBe(page.content);
      restored += page.content;
      if (page.nextOffset === null) {
        break;
      }

      expect(page.nextOffset).toBeGreaterThan(offset);
      offset = page.nextOffset;
    } while (offset < document.content.length);

    expect(restored).toBe(document.content);
    expect(memoryDocumentPage(document, 3999, 1)).toMatchObject({
      content: "🚀",
      nextOffset: 4001,
    });
    expect(() => memoryDocumentPage(document, document.content.length + 1)).toThrow();
  });
});

describe("source-grounded memory corrections", () => {
  const sources = [
    { id: "correction", text: "Use Cloudflare for deployments now. Keep concise answers." },
  ];

  it("refuses invented sources, mismatched quotes and ambiguous edits", () => {
    for (const evidence of [
      { messageId: "foreign", quote: "Use Cloudflare" },
      { messageId: "correction", quote: "Use AWS" },
    ]) {
      expect(() =>
        applyMemoryReflectionProposal(
          "Netlify",
          {
            edits: [{ before: "Netlify", after: "Cloudflare", evidence: [evidence] }],
            changeNote: "Correction",
          },
          sources,
        ),
      ).toThrow();
    }

    expect(() =>
      applyMemoryReflectionProposal(
        "Netlify Netlify",
        {
          edits: [
            {
              before: "Netlify",
              after: "Cloudflare",
              evidence: [{ messageId: "correction", quote: "Use Cloudflare" }],
            },
          ],
          changeNote: "Correction",
        },
        sources,
      ),
    ).toThrow();
  });
  it("does not create duplicates or change a document for a no-change proposal", () => {
    expect(
      applyMemoryReflectionProposal(
        "Prefer concise answers.",
        { edits: [], changeNote: "Already current" },
        sources,
      ),
    ).toBe("Prefer concise answers.");
    expect(
      applyMemoryReflectionProposal(
        "Prefer concise answers.",
        {
          edits: [
            {
              before: "",
              after: "Prefer concise answers.",
              evidence: [{ messageId: "correction", quote: "Keep concise answers." }],
            },
          ],
          changeNote: "No duplicate",
        },
        sources,
      ),
    ).toBe("Prefer concise answers.");
  });
});
