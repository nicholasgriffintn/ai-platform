import { describe, expect, it } from "vitest";

import { fixMarkdown } from "./markdown";

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
