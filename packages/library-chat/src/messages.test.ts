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

  it("replaces only the matched tag, leaving surrounding prose intact", () => {
    const { content } = formattedMessageContent(
      "assistant",
      'one <artifact identifier="a">x</artifact> two <artifact identifier="b">y</artifact> three',
    );

    expect(content).toBe("one [[ARTIFACT:a]] two [[ARTIFACT:b]] three");
  });

  it("keeps an unterminated artifact and marks it open", () => {
    const { artifacts, content } = formattedMessageContent(
      "assistant",
      '<artifact identifier="a">partial',
    );

    expect(artifacts[0]).toMatchObject({ identifier: "a", isOpen: true, content: "partial" });
    expect(content).toBe("[[ARTIFACT:a]]");
  });

  it("ignores a tag whose name merely starts with artifact", () => {
    const { artifacts } = formattedMessageContent(
      "assistant",
      '<artifactoid identifier="a">body</artifactoid>',
    );

    expect(artifacts).toHaveLength(0);
  });

  it("leaves artifacts alone for non-assistant roles", () => {
    const { artifacts } = formattedMessageContent(
      "user",
      '<artifact identifier="a">body</artifact>',
    );

    expect(artifacts).toHaveLength(0);
  });

  it("stays linear on an unterminated artifact tag padded with whitespace", () => {
    const hostile = `<artifact ${" ".repeat(200_000)}`;
    const startedAt = performance.now();

    formattedMessageContent("assistant", hostile);

    expect(performance.now() - startedAt).toBeLessThan(100);
  });
});
