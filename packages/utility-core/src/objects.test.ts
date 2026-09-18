import { describe, expect, it } from "vitest";

import { readNonEmptyString, readOptionalString } from "./objects.js";

describe("readNonEmptyString", () => {
  it("returns strings and rejects everything else", () => {
    expect(readNonEmptyString("value")).toBe("value");
    expect(readNonEmptyString("")).toBeUndefined();
    expect(readNonEmptyString(undefined)).toBeUndefined();
    expect(readNonEmptyString(null)).toBeUndefined();
    expect(readNonEmptyString(42)).toBeUndefined();
    expect(readNonEmptyString({})).toBeUndefined();
  });

  it("keeps empty strings only in the optional reader", () => {
    expect(readOptionalString("")).toBe("");
    expect(readNonEmptyString("")).toBeUndefined();
  });
});
