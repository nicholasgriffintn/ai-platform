import { describe, expect, it } from "vitest";

import { readWebSearchData } from "./web-search";

describe("readWebSearchData", () => {
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
