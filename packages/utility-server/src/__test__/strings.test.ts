import { describe, expect, it } from "vitest";

import { getUtf8ByteLength } from "../strings.js";

describe("getUtf8ByteLength", () => {
  it("counts encoded bytes rather than UTF-16 code units", () => {
    expect(getUtf8ByteLength("café 📄")).toBe(10);
  });
});
