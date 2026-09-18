import { afterEach, describe, expect, it, vi } from "vitest";

import { previousUtcDay, runInfraReconciliation } from "../reconciliation";

function createRepositories(
  attributed: Array<{ resource: string; unit: string; quantity: number; cost_micros: number }> = [],
) {
  const summariseInfrastructureDay = vi.fn(async () => attributed);
  const upsertDay = vi.fn(async () => {});

  return {
    summariseInfrastructureDay,
    upsertDay,
    repositories: {
      usageEvents: { summariseInfrastructureDay },
      infraCostDaily: { upsertDay },
    } as any,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runInfraReconciliation", () => {
  it("no-ops without touching the network when the analytics token is absent", async () => {
    const fetchSpy = vi.fn();

    vi.stubGlobal("fetch", fetchSpy);

    const mocks = createRepositories();
    const result = await runInfraReconciliation({
      env: { ACCOUNT_ID: "acct" } as any,
      day: "2026-08-31",
      repositories: mocks.repositories,
    });

    expect(result).toEqual({ status: "skipped", day: "2026-08-31", rowsWritten: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mocks.upsertDay).not.toHaveBeenCalled();
  });

  it("prices reported totals and records what we attributed for the same resource", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: {
            viewer: {
              accounts: [
                {
                  d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 2_000_000, rowsWritten: 1_000 } }],
                },
              ],
            },
          },
        }),
      ),
    );

    const mocks = createRepositories([
      { resource: "d1", unit: "d1_rows_read", quantity: 1_500_000, cost_micros: 1500 },
    ]);

    const result = await runInfraReconciliation({
      env: { ACCOUNT_ID: "acct", CLOUDFLARE_ANALYTICS_API_TOKEN: "token" } as any,
      day: "2026-08-31",
      repositories: mocks.repositories,
    });

    expect(result.status).toBe("success");
    expect(mocks.upsertDay).toHaveBeenCalledWith(
      expect.objectContaining({
        day: "2026-08-31",
        resource: "d1",
        unit: "d1_rows_read",
        quantity: 2_000_000,
        costMicros: 2000,
        attributedCostMicros: 1500,
      }),
    );
  });

  it("survives a failing analytics response without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 403 })),
    );

    const mocks = createRepositories();

    await expect(
      runInfraReconciliation({
        env: { ACCOUNT_ID: "acct", CLOUDFLARE_ANALYTICS_API_TOKEN: "token" } as any,
        day: "2026-08-31",
        repositories: mocks.repositories,
      }),
    ).resolves.toEqual({ status: "success", day: "2026-08-31", rowsWritten: 0 });
  });
});

describe("previousUtcDay", () => {
  it("returns the UTC day before the given instant", () => {
    expect(previousUtcDay(new Date("2026-09-01T00:30:00.000Z"))).toBe("2026-08-31");
  });
});
