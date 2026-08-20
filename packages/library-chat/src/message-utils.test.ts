import { describe, expect, it } from "vitest";

import { processCustomXmlTags } from "./message-utils";

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
