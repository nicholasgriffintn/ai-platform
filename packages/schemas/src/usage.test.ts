import { describe, expect, it } from "vitest";

import { totalChatRunCredits, type ChatRunDelegatedUsage, type ChatRunUsage } from "./usage.js";

function usage(creditMicros: number | null, delegated: ChatRunDelegatedUsage[] = []): ChatRunUsage {
  return {
    protocolVersion: 1,
    runId: "run_parent",
    currentAttempt: 1,
    measurement: creditMicros === null ? "unknown" : "reported",
    reservation: null,
    consumption: {
      status: creditMicros === null ? "unknown" : "recorded",
      eventCount: creditMicros === null ? 0 : 1,
      costMicros: creditMicros,
      creditMicros,
      estimatedPriceEventCount: 0,
      bySource: [],
    },
    attempts: [],
    settlement: { status: "settled", at: null },
    delegated,
  };
}

function delegated(
  state: ChatRunDelegatedUsage["state"],
  creditMicros: number | null,
): ChatRunDelegatedUsage {
  return {
    delegationId: `delegation_${state}`,
    teammateId: "teammate-1",
    teammateName: "Researcher",
    state,
    runId: "run_child",
    measurement: creditMicros === null ? "unknown" : "reported",
    consumptionStatus: creditMicros === null ? "processing" : "recorded",
    creditMicros,
  };
}

describe("totalChatRunCredits", () => {
  it("adds delegated work to the run and calls it complete once everything is recorded", () => {
    expect(
      totalChatRunCredits(usage(2_000_000, [delegated("done", 500_000), delegated("failed", 0)])),
    ).toEqual({ recordedCreditMicros: 2_500_000, complete: true });
  });

  it("treats live or unreported delegated work as a lower bound, never as zero", () => {
    expect(totalChatRunCredits(usage(2_000_000, [delegated("running", 300_000)]))).toEqual({
      recordedCreditMicros: 2_300_000,
      complete: false,
    });
    expect(totalChatRunCredits(usage(2_000_000, [delegated("done", null)])).complete).toBe(false);
    expect(totalChatRunCredits(usage(null)).complete).toBe(false);
  });
});
