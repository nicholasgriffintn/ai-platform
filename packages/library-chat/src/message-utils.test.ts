import { describe, expect, it } from "vitest";

import { processCustomXmlTags, splitContentByArtifacts } from "./message-utils";

describe("processCustomXmlTags", () => {
  it("converts a custom tag to a heading", () => {
    expect(processCustomXmlTags("<second_opinion>Looks fine</second_opinion>")).toBe(
      "**Second Opinion**\n\nLooks fine\n\n",
    );
  });

  it("leaves markup inside inline code alone", () => {
    const source = "Use `<div>content</div>` to wrap it.";

    expect(processCustomXmlTags(source)).toBe(source);
  });

  it("leaves markup inside fenced code alone", () => {
    const source = "```html\n<section>hello</section>\n```";

    expect(processCustomXmlTags(source)).toBe(source);
  });

  it("restores fenced code containing replacement patterns verbatim", () => {
    const source = '```js\nvalue.replace(/a/, "$&$\'");\n```';

    expect(processCustomXmlTags(source)).toBe(source);
  });
});

describe("splitContentByArtifacts", () => {
  it("separates text from the identifiers between markers", () => {
    expect(
      splitContentByArtifacts("before [[ARTIFACT:one]] middle [[ARTIFACT:two]] after"),
    ).toEqual({
      textParts: ["before ", " middle ", " after"],
      identifiers: ["one", "two"],
    });
  });

  it("leaves content with no marker as a single part", () => {
    expect(splitContentByArtifacts("just text")).toEqual({
      textParts: ["just text"],
      identifiers: [],
    });
  });

  it("ignores a marker that never closes, and one with an empty identifier", () => {
    expect(splitContentByArtifacts("a [[ARTIFACT:unclosed").textParts).toEqual([
      "a [[ARTIFACT:unclosed",
    ]);
    expect(splitContentByArtifacts("a [[ARTIFACT:]] b").identifiers).toEqual([]);
  });

  it("refuses an identifier containing a closing bracket, as the old pattern did", () => {
    expect(splitContentByArtifacts("a [[ARTIFACT:on]e]] b").identifiers).toEqual([]);
  });

  it("stays linear on a marker followed by a long unterminated run", () => {
    const started = Date.now();

    splitContentByArtifacts(`[[ARTIFACT:${"a".repeat(200_000)}`);

    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
