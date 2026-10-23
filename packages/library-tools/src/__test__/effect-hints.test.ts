import { describe, expect, it } from "vitest";

import {
  effectClassFromToolHints,
  resolveToolEffectClassWithHints,
  type ToolEffects,
} from "../effects.js";

describe("tool effect hints", () => {
  it("maps vendor hints onto effect classes", () => {
    expect(effectClassFromToolHints({ readOnly: true })).toBe("read");
    expect(effectClassFromToolHints({ destructive: true })).toBe("destructive");
    expect(effectClassFromToolHints({ readOnly: true, destructive: true })).toBe("read");
    expect(effectClassFromToolHints({})).toBe("write");
  });

  it("prefers the host's hints over the declared class", async () => {
    const effects: ToolEffects<{ tool: string }, { known: Record<string, boolean> }> = {
      effectClass: "write",
      hints: (input, host) =>
        input.tool in host.known ? { readOnly: host.known[input.tool] } : undefined,
    };
    const host = { known: { search: true, create: false } };

    await expect(resolveToolEffectClassWithHints(effects, { tool: "search" }, host)).resolves.toBe(
      "read",
    );
    await expect(resolveToolEffectClassWithHints(effects, { tool: "create" }, host)).resolves.toBe(
      "write",
    );
  });

  it("falls back to the declared class when the host has no hints or fails", async () => {
    const effects: ToolEffects<{ tool: string }> = {
      effectClass: "write",
      hints: () => {
        throw new Error("integration unreachable");
      },
    };

    await expect(resolveToolEffectClassWithHints(effects, { tool: "x" }, {})).resolves.toBe(
      "write",
    );
    await expect(
      resolveToolEffectClassWithHints({ effectClass: "read", hints: () => undefined }, {}, {}),
    ).resolves.toBe("read");
  });
});
