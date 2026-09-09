import { describe, expect, it } from "vitest";

import { readWebSearchData } from "./web-search";

describe("readWebSearchData", () => {
  it("returns null for payloads that are not records", () => {
    expect(readWebSearchData(undefined)).toBeNull();
    expect(readWebSearchData("no results")).toBeNull();
  });

  it("leaves the answer undefined when the provider returned no summary", () => {
    const search = readWebSearchData({
      sources: [{ url: "https://example.com", title: "Example" }],
    });

    expect(search?.answer).toBeUndefined();
    expect(search?.sources).toEqual([{ url: "https://example.com", title: "Example" }]);
  });

  it("drops sources without a url and titles that are not strings", () => {
    const search = readWebSearchData({
      answer: "Summary",
      sources: [{ title: "Missing url" }, { url: "https://example.com", title: 42 }],
    });

    expect(search?.sources).toEqual([{ url: "https://example.com", title: undefined }]);
  });

  it("reads similar questions from an array or a stringified array", () => {
    expect(readWebSearchData({ similarQuestions: ["a", 1, "b"] })?.similarQuestions).toEqual([
      "a",
      "b",
    ]);
    expect(readWebSearchData({ similarQuestions: '["a","b"]' })?.similarQuestions).toEqual([
      "a",
      "b",
    ]);
  });
});
