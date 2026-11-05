import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";

import { provenanceLookupRateLimit } from "../provenanceRateLimit";

function contextFor(limit: ReturnType<typeof vi.fn> | undefined, address?: string): Context {
  return {
    env: limit ? { PROVENANCE_RATE_LIMITER: { limit } } : {},
    req: { header: () => address },
  } as unknown as Context;
}

describe("provenanceLookupRateLimit", () => {
  it("counts lookups per address in their own bucket", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const next = vi.fn();

    await provenanceLookupRateLimit(contextFor(limit, "203.0.113.9"), next);

    expect(limit).toHaveBeenCalledWith({ key: "provenance-203.0.113.9" });
    expect(next).toHaveBeenCalled();
  });

  it("rejects a lookup over the limit", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const next = vi.fn();

    await expect(
      provenanceLookupRateLimit(contextFor(limit, "203.0.113.9"), next),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses to serve lookups when the limiter is not bound", async () => {
    await expect(provenanceLookupRateLimit(contextFor(undefined), vi.fn())).rejects.toThrow(
      "Rate limiter not configured",
    );
  });
});
