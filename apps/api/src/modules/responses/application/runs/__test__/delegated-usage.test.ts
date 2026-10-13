import type { ChatRunUsage, Delegation } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { summariseDelegatedUsage } from "../delegated-usage";

const delegation = {
  id: "delegation-1",
  parentConversationId: "conversation-parent",
  childConversationId: "conversation-child",
  parentRunId: "run_parent",
  depth: 1,
  teammateId: "teammate-1",
  goal: "Check the pricing page",
  waitFor: "all",
  budget: { maxCreditMicros: 1_000_000, maxSteps: 10, deadline: "2026-10-10T12:00:00.000Z" },
  state: "running",
  result: null,
  memoryBindings: [],
  continuationMode: "new",
  createdAt: "2026-10-10T11:00:00.000Z",
  updatedAt: null,
} satisfies Delegation;

describe("summariseDelegatedUsage", () => {
  it("reports a delegate whose run has not been accepted as unknown rather than free", () => {
    expect(
      summariseDelegatedUsage([delegation], new Map(), new Map([["teammate-1", "Researcher"]])),
    ).toEqual([
      {
        delegationId: "delegation-1",
        teammateId: "teammate-1",
        teammateName: "Researcher",
        state: "running",
        runIds: [],
        measurement: "unknown",
        consumptionStatus: "unknown",
        creditMicros: null,
      },
    ]);
  });

  it("carries the child run's recorded consumption", () => {
    const childUsage: ChatRunUsage = {
      protocolVersion: 1,
      runId: "run_child",
      currentAttempt: 1,
      measurement: "reported",
      reservation: null,
      consumption: {
        status: "recorded",
        eventCount: 2,
        costMicros: 300_000,
        creditMicros: 420_000,
        estimatedPriceEventCount: 0,
        bySource: [],
      },
      attempts: [],
      settlement: { status: "settled", at: null },
    };
    const resumedChildUsage: ChatRunUsage = {
      ...childUsage,
      runId: "run_child_resume",
      consumption: { ...childUsage.consumption, creditMicros: 200_000 },
    };

    expect(
      summariseDelegatedUsage(
        [delegation],
        new Map([["delegation-1", [childUsage, resumedChildUsage]]]),
        new Map(),
      )[0],
    ).toMatchObject({
      runIds: ["run_child", "run_child_resume"],
      teammateName: null,
      consumptionStatus: "recorded",
      creditMicros: 620_000,
    });
  });
});
