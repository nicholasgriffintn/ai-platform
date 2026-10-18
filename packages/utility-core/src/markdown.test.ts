import { describe, expect, it } from "vitest";

import { fixMarkdown, removeMarkdownBlock, splitMarkdownBlocks } from "./markdown";

describe("fixMarkdown", () => {
  it("preserves complete markdown while downgrading top-level headings", () => {
    expect(fixMarkdown("# Title\n\nA complete paragraph.")).toBe(
      "## Title\n\nA complete paragraph.",
    );
  });

  it("completes streaming emphasis, links, and code fences", () => {
    expect(fixMarkdown("**Bold", true)).toBe("**Bold**");
    expect(fixMarkdown("[Link", true)).toBe("[Link](...)");
    expect(fixMarkdown("```ts\nconst answer = 42", true)).toBe("```ts\nconst answer = 42\n```");
  });
});

const MEMORY = [
  "# Preferences",
  "",
  "- Prefers meetings before noon",
  "- Writes in British English",
  "  and dislikes exclamation marks",
  "",
  "Works on the Polychat launch.",
  "",
  "## People",
  "1. Sam runs design",
].join("\n");

describe("markdown blocks", () => {
  it("splits headings, list items with their continuations, and paragraphs", () => {
    expect(splitMarkdownBlocks(MEMORY).map(({ kind, text }) => ({ kind, text }))).toEqual([
      { kind: "heading", text: "Preferences" },
      { kind: "item", text: "Prefers meetings before noon" },
      { kind: "item", text: "Writes in British English and dislikes exclamation marks" },
      { kind: "paragraph", text: "Works on the Polychat launch." },
      { kind: "heading", text: "People" },
      { kind: "item", text: "Sam runs design" },
    ]);
  });

  it("forgets one block and leaves the rest of the document intact", () => {
    const [, , britishEnglish] = splitMarkdownBlocks(MEMORY);

    expect(removeMarkdownBlock(MEMORY, britishEnglish)).toBe(
      [
        "# Preferences",
        "",
        "- Prefers meetings before noon",
        "",
        "Works on the Polychat launch.",
        "",
        "## People",
        "1. Sam runs design",
      ].join("\n"),
    );
  });
});
