import { describe, expect, it, vi } from "vitest";

import { isUsageExhausted, readUsageLimitState } from "../limitState";

function manager(limits: unknown) {
  return { getUsageLimits: vi.fn(async () => limits) } as any;
}

describe("readUsageLimitState", () => {
  it("reports a user who has spent their daily allowance as exhausted", async () => {
    await expect(
      readUsageLimitState(manager({ daily: { used: 100, limit: 100 } })),
    ).resolves.toEqual({ exhausted: true, used: 100, limit: 100 });
  });

  it("reports a user with allowance left as not exhausted", async () => {
    await expect(
      readUsageLimitState(manager({ daily: { used: 99, limit: 100 } })),
    ).resolves.toEqual({ exhausted: false, used: 99, limit: 100 });
  });

  it("prefers the pro allowance when the account has one", async () => {
    await expect(
      readUsageLimitState(
        manager({ daily: { used: 0, limit: 1000 }, pro: { used: 50, limit: 50 } }),
      ),
    ).resolves.toMatchObject({ exhausted: true, limit: 50 });
  });

  it("treats an unreadable limit as not exhausted so a storage blip cannot lock a user out", async () => {
    const failing = {
      getUsageLimits: vi.fn(async () => {
        throw new Error("d1 unavailable");
      }),
    } as any;

    await expect(isUsageExhausted(failing)).resolves.toBe(false);
    await expect(isUsageExhausted(manager(null))).resolves.toBe(false);
    await expect(isUsageExhausted(manager({ daily: { used: 5, limit: null } }))).resolves.toBe(
      false,
    );
  });

  it("counts an overspent allowance as exhausted", async () => {
    await expect(isUsageExhausted(manager({ daily: { used: 140, limit: 100 } }))).resolves.toBe(
      true,
    );
  });
});
