import { describe, expect, it } from "vitest";

import { parseRetryAfterHeaderMs } from "./retry.js";

describe("parseRetryAfterHeaderMs", () => {
  it("reads an HTTP date as a delay from now", () => {
    const value = new Date(Date.now() + 30_000).toUTCString();

    expect(parseRetryAfterHeaderMs(value)).toBeGreaterThan(28_000);
  });

  it("clamps a past HTTP date to zero", () => {
    expect(parseRetryAfterHeaderMs(new Date(Date.now() - 30_000).toUTCString())).toBe(0);
  });

  it("ignores a missing or unparseable value", () => {
    expect(parseRetryAfterHeaderMs(null)).toBeUndefined();
    expect(parseRetryAfterHeaderMs("soon")).toBeUndefined();
  });
});
