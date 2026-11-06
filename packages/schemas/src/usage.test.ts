import { describe, expect, it } from "vitest";

import { runMeterFromUsage, type ChatRunUsage } from "./usage.js";

function usage(overrides: Partial<ChatRunUsage> = {}): ChatRunUsage {
  return {
    protocolVersion: 1,
    runId: "run-1",
    currentAttempt: 1,
    measurement: "reported",
    reservation: null,
    consumption: {
      status: "recorded",
      eventCount: 2,
      costMicros: 100,
      creditMicros: 85_000_000,
      estimatedPriceEventCount: 0,
      bySource: [],
    },
    attempts: [],
    settlement: { status: "settled", at: null },
    charge: {
      capCreditMicros: 100_000_000,
      refundedCreditMicros: 0,
      absorbedCreditMicros: 0,
    },
    ...overrides,
  };
}

describe("runMeterFromUsage", () => {
  it("rebuilds the meter for a capped run from its stored usage", () => {
    expect(runMeterFromUsage(usage())).toEqual({
      runId: "run-1",
      chargedCreditMicros: 85_000_000,
      capCreditMicros: 100_000_000,
      state: "near",
    });
  });

  it("includes what delegates have spent", () => {
    const meter = runMeterFromUsage(
      usage({
        delegated: [
          {
            delegationId: "delegation-1",
            teammateId: "teammate-1",
            teammateName: null,
            state: "done",
            runIds: ["run-2"],
            measurement: "reported",
            consumptionStatus: "recorded",
            creditMicros: 15_000_000,
          },
        ],
      }),
    );

    expect(meter).toMatchObject({ chargedCreditMicros: 100_000_000, state: "reached" });
  });

  it("shows nothing for an uncapped run", () => {
    expect(
      runMeterFromUsage(
        usage({
          charge: { capCreditMicros: null, refundedCreditMicros: 0, absorbedCreditMicros: 0 },
        }),
      ),
    ).toBeNull();
  });
});
