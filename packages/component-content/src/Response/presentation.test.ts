import { describe, expect, it } from "vitest";

import { resolveResponsePresentation, stripPresentationMetadata } from "./presentation";

describe("resolveResponsePresentation", () => {
  it("detects generated media before anything else", () => {
    expect(resolveResponsePresentation({ imageUrl: "https://cdn.test/a.png" }).kind).toBe("image");
    expect(resolveResponsePresentation({ audioUrl: "https://cdn.test/a.mp3" }).kind).toBe("audio");
    expect(resolveResponsePresentation({ url: "https://cdn.test/a.mp4" }).kind).toBe("video");
  });

  it("renders url-bearing records as sources, whatever the envelope key", () => {
    const presentation = resolveResponsePresentation({
      results: [
        { url: "https://a.test/1", title: "First", snippet: "One" },
        { link: "https://b.test/2", name: "Second" },
      ],
    });

    expect(presentation).toMatchObject({
      kind: "sources",
      sources: [
        { url: "https://a.test/1", title: "First", snippet: "One" },
        { url: "https://b.test/2", title: "Second" },
      ],
    });
  });

  it("infers a table from records that share scalar columns", () => {
    const presentation = resolveResponsePresentation({
      rows: [
        { taskId: "a", count: 1 },
        { taskId: "b", count: 2 },
      ],
    });

    expect(presentation).toMatchObject({
      kind: "table",
      headers: [
        { key: "taskId", label: "Task Id" },
        { key: "count", label: "Count" },
      ],
    });
  });

  it("declines to infer a table from ragged records", () => {
    const presentation = resolveResponsePresentation({
      rows: [{ a: 1 }, { b: 2 }],
    });

    expect(presentation.kind).not.toBe("table");
  });

  it("declines to infer a table from records holding nested objects", () => {
    const presentation = resolveResponsePresentation({
      rows: [
        { id: "a", meta: { deep: true } },
        { id: "b", meta: { deep: false } },
      ],
    });

    expect(presentation.kind).not.toBe("table");
  });

  it("treats a lone prose field as the whole result", () => {
    expect(resolveResponsePresentation({ markdown: "# Title" })).toEqual({
      kind: "markdown",
      content: "# Title",
    });
  });

  it("keeps prose beside other data out of the markdown branch, so nothing is hidden", () => {
    const presentation = resolveResponsePresentation({ content: "Some prose", count: 3 });

    expect(presentation.kind).not.toBe("markdown");
  });

  it("renders a flat scalar object as definitions", () => {
    expect(resolveResponsePresentation({ runId: "r1", ok: true })).toMatchObject({
      kind: "definitions",
      entries: [
        { key: "runId", label: "Run Id", value: "r1" },
        { key: "ok", label: "Ok", value: "true" },
      ],
    });
  });

  it("falls back to json for anything it cannot place", () => {
    expect(resolveResponsePresentation({ a: { b: [1, 2] }, c: [3] }).kind).toBe("json");
  });
});

describe("stripPresentationMetadata", () => {
  it("removes the chrome the API attaches beside the payload", () => {
    expect(
      stripPresentationMetadata({
        formattedName: "Get Weather",
        icon: "cloud",
        renderer: "weather",
        responseType: "custom",
        name: "get_weather",
        temperature: 12,
      }),
    ).toEqual({ temperature: 12 });
  });

  it("returns undefined when nothing but chrome was attached", () => {
    expect(
      stripPresentationMetadata({ formattedName: "Get Weather", icon: "cloud" }),
    ).toBeUndefined();
  });

  it("leaves a payload without chrome untouched", () => {
    const payload = { temperature: 12 };

    expect(stripPresentationMetadata(payload)).toBe(payload);
  });
});
