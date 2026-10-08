import { describe, expect, it } from "vitest";

import { shouldReloadForChunkError } from "./client-update";

describe("shouldReloadForChunkError", () => {
  it("reloads the first time a chunk fails to load", () => {
    expect(shouldReloadForChunkError(null, 1_000)).toBe(true);
  });

  it("does not reload again straight after a reload, so a broken deploy cannot loop", () => {
    expect(shouldReloadForChunkError(1_000, 1_000 + 60_000)).toBe(false);
    expect(shouldReloadForChunkError(1_000, 1_000 + 6 * 60_000)).toBe(true);
  });
});
