import { describe, expect, it } from "vitest";

import { readBalancedJson } from "./json";

describe("readBalancedJson", () => {
  it("stops at the matching bracket and ignores brackets inside strings", () => {
    const page = 'x = {"tracks":[{"name":"a ] \\" [ b"},{"name":"c"}],"rest":1};';
    const start = page.indexOf("[");

    expect(readBalancedJson(page, start)).toBe('[{"name":"a ] \\" [ b"},{"name":"c"}]');
    expect(readBalancedJson('{"open": [1, 2', 0)).toBeNull();
  });
});
