import { describe, expect, it } from "vitest";

import { extractMarkdownOutline } from "./markdown-editor";

describe("extractMarkdownOutline", () => {
  it("reads the level and title of each heading, with its line number", () => {
    expect(extractMarkdownOutline("# One\ntext\n### Three")).toEqual([
      { level: 1, title: "One", line: 1 },
      { level: 3, title: "Three", line: 3 },
    ]);
  });

  it("drops the closing hashes of a balanced heading", () => {
    expect(extractMarkdownOutline("## Title ##")[0]?.title).toBe("Title");
  });

  it("needs whitespace between the hashes and the title", () => {
    expect(extractMarkdownOutline("#NoSpace")).toEqual([]);
  });

  it("ignores more hashes than markdown allows", () => {
    expect(extractMarkdownOutline("####### Seven")).toEqual([]);
  });

  it("ignores a heading with no title left after trimming", () => {
    expect(extractMarkdownOutline("##   ")).toEqual([]);
    expect(extractMarkdownOutline("## ###")).toEqual([]);
  });

  it("reads a heading on a line that ends with a carriage return", () => {
    expect(extractMarkdownOutline("## Title\r")[0]?.title).toBe("Title");
  });

  it("stays linear on a heading followed by a long run of spaces", () => {
    const started = Date.now();

    expect(extractMarkdownOutline(`#${" ".repeat(200_000)}\r`)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
