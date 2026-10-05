import { describe, expect, it } from "vitest";

import {
  requireToolEffects,
  resolveToolDestination,
  resolveToolEffectClass,
  type ToolEffects,
} from "../effects.js";

describe("tool effects", () => {
  it("treats an undeclared effect as a write", () => {
    expect(resolveToolEffectClass(undefined, {})).toBe("write");
  });

  it("resolves an input-dependent class and destination", () => {
    const effects: ToolEffects<{ method: string; channel?: string }> = {
      effectClass: (input) => (input.method === "GET" ? "read" : "write"),
      destination: (input) => input.channel,
    };

    expect(resolveToolEffectClass(effects, { method: "GET" })).toBe("read");
    expect(resolveToolEffectClass(effects, { method: "POST" })).toBe("write");
    expect(resolveToolDestination(effects, { method: "POST", channel: " #standup " })).toBe(
      "#standup",
    );
    expect(resolveToolDestination(effects, { method: "POST", channel: "  " })).toBeUndefined();
  });

  it("refuses a catalogue entry without declared effects", () => {
    expect(() => requireToolEffects("send_invoice", undefined)).toThrowError(
      expect.objectContaining({ code: "missing_effects", toolName: "send_invoice" }),
    );
  });
});
