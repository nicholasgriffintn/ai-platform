import { describe, expect, it } from "vitest";

import { formattedMessageContent } from "./messages.js";

describe("formattedMessageContent artifacts", () => {
  it("keeps an unterminated artifact and marks it open", () => {
    const { artifacts, content } = formattedMessageContent(
      "assistant",
      '<artifact identifier="a">partial',
    );

    expect(artifacts[0]).toMatchObject({ identifier: "a", isOpen: true, content: "partial" });
    expect(content).toBe("[[ARTIFACT:a]]");
  });

  it("stays linear on an unterminated artifact tag padded with whitespace", () => {
    const hostile = `<artifact ${" ".repeat(200_000)}`;
    const startedAt = performance.now();

    formattedMessageContent("assistant", hostile);

    expect(performance.now() - startedAt).toBeLessThan(100);
  });
});
