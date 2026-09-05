import { describe, expect, it } from "vitest";

import { SseLineBuffer } from "../sse-line-buffer";

describe("SseLineBuffer", () => {
  it("bounds both partial and newline-terminated provider events", () => {
    expect(() => new SseLineBuffer(8).append("123456789")).toThrow(
      "Provider stream event exceeded 8 characters",
    );
    expect(() => new SseLineBuffer(8).append("123456789\n")).toThrow(
      "Provider stream event exceeded 8 characters",
    );
  });

  it("retains a partial event while returning completed lines in order", () => {
    const buffer = new SseLineBuffer(16);

    expect(buffer.append("first\nsec")).toEqual(["first"]);
    expect(buffer.append("ond\nthird")).toEqual(["second"]);
  });
});
