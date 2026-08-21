import { describe, expect, it } from "vitest";

import { formattedMessageContent } from "./messages";

describe("formattedMessageContent artifacts", () => {
  it("extracts an artifact and its attributes", () => {
    const { artifacts, content } = formattedMessageContent(
      "assistant",
      'before <artifact identifier="a" type="application/code" title="Demo">body</artifact> after',
    );

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({ identifier: "a", title: "Demo", content: "body" });
    expect(content).toContain("[[ARTIFACT:a]]");
  });

  it("handles repeated whitespace between the tag and its attributes", () => {
    const { artifacts } = formattedMessageContent(
      "assistant",
      '<artifact   identifier="b"   title="Spaced">body</artifact>',
    );

    expect(artifacts[0]).toMatchObject({ identifier: "b", title: "Spaced" });
  });

  it("stays linear on an unterminated artifact tag padded with whitespace", () => {
    const hostile = `<artifact ${" ".repeat(200_000)}`;
    const startedAt = performance.now();

    formattedMessageContent("assistant", hostile);

    expect(performance.now() - startedAt).toBeLessThan(100);
  });
});
