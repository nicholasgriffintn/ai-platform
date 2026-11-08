import { describe, expect, it } from "vitest";

import { requireToolEffects, resolveToolEffectClass } from "../effects.js";

describe("tool effects", () => {
  it("treats an undeclared effect as a write", () => {
    expect(resolveToolEffectClass(undefined, {})).toBe("write");
  });

  it("refuses a catalogue entry without declared effects", () => {
    expect(() => requireToolEffects("send_invoice", undefined)).toThrowError(
      expect.objectContaining({ code: "missing_effects", toolName: "send_invoice" }),
    );
  });
});
