import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { InfraCostDailyRepository } from "~/modules/infra/infrastructure/InfraCostDailyRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";

import { runInfraReconciliation } from "../reconciliation";

function createRepositories(
  attributed: Array<{ resource: string; unit: string; quantity: number; cost_micros: number }> = [],
) {
  const summariseInfrastructureDay = vi.fn(async () => attributed);
  const upsertDay = vi.fn(async () => {});

  return {
    summariseInfrastructureDay,
    upsertDay,
    repositories: fakeRepositories([
      [UsageEventRepository, { summariseInfrastructureDay }],
      [InfraCostDailyRepository, { upsertDay }],
    ]),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runInfraReconciliation", () => {
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
});
