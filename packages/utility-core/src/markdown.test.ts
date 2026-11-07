import { describe, expect, it } from "vitest";

import {
  fixMarkdown,
  removeMarkdownBlock,
  splitMarkdownBlocks,
  splitMarkdownSegments,
  stripModelControlTokens,
} from "./markdown";

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

describe("stripModelControlTokens", () => {
  it("keeps only the final answer when a model leaks its channels", () => {
    expect(
      stripModelControlTokens(
        "analysis The user asks.<|end|><|start|>assistantfinal Canberra.<|return|>",
      ),
    ).toBe("Canberra.");
  });

  it("hides a leaked tool plan", () => {
    expect(
      stripModelControlTokens("analysis> need images.assistant to=functions.create_image json={}"),
    ).toBe("");
  });

  it("hides a leaked tool plan wrapped in control tokens", () => {
    expect(
      stripModelControlTokens("analysis> need images.assistant<|channel|> to=functions.x json={}"),
    ).toBe("");
  });

  it("leaves ordinary text alone", () => {
    expect(stripModelControlTokens("Use a | b in a table")).toBe("Use a | b in a table");
    expect(stripModelControlTokens("analysis of the assistant role")).toBe(
      "analysis of the assistant role",
    );
  });
});

describe("splitMarkdownSegments", () => {
  const texts = (markdown: string) => splitMarkdownSegments(markdown).map(({ text }) => text);

  it("splits top-level blocks at blank lines", () => {
    expect(texts("## Title\n\nFirst.\n\nSecond.")).toEqual(["## Title", "First.", "Second."]);
  });

  it("keeps a fenced block whole, including blank lines and shorter fences", () => {
    const fenced = "````md\nfirst\n\n```\n\nnot closed\n````";

    expect(texts(`Before.\n\n${fenced}\n\nAfter.`)).toEqual(["Before.", fenced, "After."]);
  });

  it("does not split inside an unterminated fence", () => {
    const open = "```ts\nconst a = 1;\n\nconst b = 2;";

    expect(texts(`Intro.\n\n${open}`)).toEqual(["Intro.", open]);
  });

  it("keeps loose lists and indented continuations together", () => {
    const list = "- one\n\n- two\n\n  continuation\n\n1. three";

    expect(texts(`${list}\n\nAfter.`)).toEqual([list, "After."]);
  });

  it("keeps settled segments stable as text streams in", () => {
    const settled = splitMarkdownSegments("One.\n\nTwo.\n\nThr").slice(0, 2);

    expect(splitMarkdownSegments("One.\n\nTwo.\n\nThree is here.").slice(0, 2)).toEqual(settled);
  });
});
