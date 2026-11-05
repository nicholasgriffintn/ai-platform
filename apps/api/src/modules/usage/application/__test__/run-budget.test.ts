import type { RunChargeState } from "@ngriffin_uk/polychat-ai-billing";
import { describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";

import { readRunCapDecision, RunBudget, type RunBudgetParams } from "../run-budget";

const CREDIT = 1_000_000;

const modelConfig = {
  costPer1kInputTokens: 0.003,
  costPer1kOutputTokens: 0.015,
  maxTokens: 1000,
} as RunBudgetParams["modelConfig"];

function budget(state: Partial<RunChargeState>, overrides: Partial<RunBudgetParams> = {}) {
  return new RunBudget({
    runId: "run-1",
    capCreditMicros: 100 * CREDIT,
    store: {
      getRunChargeState: vi.fn(async () => ({
        capCreditMicros: 100 * CREDIT,
        refunded: false,
        chargedCreditMicros: 0,
        ...state,
      })),
    },
    raiseCap: vi.fn(async () => true),
    modelConfig,
    modelCostIsCharged: true,
    liveMeter: true,
    ...overrides,
  });
}

const messages = [{ role: "user" as const, content: "Do the work" }];

describe("RunBudget", () => {
  it("lets a step through while the estimate fits under the cap", async () => {
    expect(await budget({}).beforeStep(messages)).toEqual({ kind: "proceed" });
  });

  it("pauses before a step that could cross the cap, offering more than the step needs", async () => {
    const decision = await budget({ chargedCreditMicros: 99 * CREDIT }).beforeStep(messages);

    expect(decision.kind).toBe("pause");

    if (decision.kind === "pause") {
      expect(decision.pause.options).toEqual([decision.pause.raiseOption, "Stop here"]);
      expect(decision.pause.proposedCapCreditMicros).toBe(200 * CREDIT);
    }
  });

  it("uses the stored cap, so a raised cap takes effect on the next step", async () => {
    const decision = await budget({
      chargedCreditMicros: 99 * CREDIT,
      capCreditMicros: 200 * CREDIT,
    }).beforeStep(messages);

    expect(decision).toEqual({ kind: "proceed" });
  });

  it("stops without another step once the person chooses to stop", async () => {
    const run = budget({ chargedCreditMicros: 99 * CREDIT });

    await run.applyDecision({ kind: "stop" });

    expect(await run.beforeStep(messages)).toEqual({ kind: "stopped" });
  });

  it("refuses to start under a cap too small for one step", async () => {
    const run = budget({}, { capCreditMicros: CREDIT / 100 });

    await expect(run.assertStartable(messages)).rejects.toThrow("too low to start");
  });

  it("does not count model cost for a BYOK run", async () => {
    const run = budget({ chargedCreditMicros: 100 * CREDIT - 1 }, { modelCostIsCharged: false });

    expect(await run.beforeStep(messages)).toEqual({ kind: "proceed" });
  });

  it("fails closed when a capped run's spend cannot be read", async () => {
    const run = budget(
      {},
      {
        store: { getRunChargeState: vi.fn().mockRejectedValue(new Error("d1 unavailable")) },
      },
    );

    await expect(run.beforeStep(messages)).rejects.toThrow("d1 unavailable");
  });

  it("writes usage inline for capped runs so the ledger is current at each step", () => {
    expect(budget({}, { liveMeter: false }).usageDelivery).toBe("inline");
    expect(budget({}, { liveMeter: false, capCreditMicros: null }).usageDelivery).toBeUndefined();
  });

  it("reports the meter state against the cap", async () => {
    expect(await budget({ chargedCreditMicros: 85 * CREDIT }).readMeter()).toEqual({
      runId: "run-1",
      chargedCreditMicros: 85 * CREDIT,
      capCreditMicros: 100 * CREDIT,
      state: "near",
    });
  });
});

describe("readRunCapDecision", () => {
  const resolved = (option: string): Message => ({
    role: "tool",
    content: "",
    data: {
      runCap: { raiseOption: "Raise cap to 200 credits", proposedCapCreditMicros: 200 * CREDIT },
      approvalResolution: { option, resolution: "rejected" },
    },
  });

  it("raises only for the stored raise option, whatever resolution the client sent", () => {
    expect(readRunCapDecision([resolved("Raise cap to 200 credits")])).toEqual({
      kind: "raise",
      capCreditMicros: 200 * CREDIT,
    });
    expect(readRunCapDecision([resolved("Stop here")])).toEqual({ kind: "stop" });
  });

  it("ignores ordinary approvals", () => {
    expect(
      readRunCapDecision([
        { role: "tool", content: "", data: { approvalResolution: { option: "Approve" } } },
      ]),
    ).toBeNull();
  });
});
