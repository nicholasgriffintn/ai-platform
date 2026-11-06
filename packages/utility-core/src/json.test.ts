import { describe, expect, it } from "vitest";

import { describeValue, readBalancedJson, withoutJsonText } from "./json";

describe("readBalancedJson", () => {
  it("stops at the matching bracket and ignores brackets inside strings", () => {
    const page = 'x = {"tracks":[{"name":"a ] \\" [ b"},{"name":"c"}],"rest":1};';
    const start = page.indexOf("[");

    expect(readBalancedJson(page, start)).toBe('[{"name":"a ] \\" [ b"},{"name":"c"}]');
    expect(readBalancedJson('{"open": [1, 2', 0)).toBeNull();
  });
});

describe("withoutJsonText", () => {
  it("removes JSON lines and keeps the prose around them", () => {
    expect(withoutJsonText('deepwiki offers 3 tools.\n{"name":"ask"}\n{"name":"read"}')).toBe(
      "deepwiki offers 3 tools.",
    );
  });

  it("removes a whole JSON document", () => {
    expect(withoutJsonText('[\n  {"title": "A"}\n]')).toBe("");
  });

  it("leaves prose that only looks a bit like JSON", () => {
    expect(withoutJsonText("[Read more] about this")).toBe("[Read more] about this");
  });
});

describe("describeValue", () => {
  it("turns objects and JSON text into labelled lines", () => {
    const value = { query_text: "tea", exact: true, filters: { tags: ["a", "b"], page: 2 } };
    const expected = "Query text: tea\nExact: Yes\nFilters:\n  Tags: a, b\n  Page: 2";

    expect(describeValue(value)).toBe(expected);
    expect(describeValue(JSON.stringify(value))).toBe(expected);
  });

  it("leaves plain text alone and drops empty values", () => {
    expect(describeValue("just text")).toBe("just text");
    expect(describeValue({ name: "", note: null })).toBe("");
  });
});
