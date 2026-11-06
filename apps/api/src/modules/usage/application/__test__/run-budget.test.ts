import type { RunChargeState } from "@ngriffin_uk/polychat-ai-billing";
import { describe, expect, it, vi } from "vitest";

import type { Message } from "~/types";

import { RunBudget, runCapStoppedNotice, type RunBudgetParams } from "../run-budget";

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
    modelConfig,
    modelCostIsCharged: true,
    ...overrides,
  });
}

const messages = [{ role: "user" as const, content: "Do the work" }];

describe("runCapStoppedNotice", () => {
  it("keeps the images a run made before it stopped", () => {
    const notice = runCapStoppedNotice([
      { role: "tool", name: "create_image", content: "done", data: { url: "/outputs/a/content" } },
      { role: "tool", name: "web_search", content: "done", data: { url: "https://example.com" } },
    ] as Message[]);

    expect(notice).toBe(
      "This run stopped at its credit cap.\n\n![Generated image](/outputs/a/content)",
    );
  });
});

describe("RunBudget", () => {
  it("lets a step through while the estimate fits under the cap", async () => {
    expect(await budget({}).beforeStep(messages)).toEqual({ kind: "proceed" });
  });

  it("stops before a step that could cross the cap", async () => {
    const decision = await budget({ chargedCreditMicros: 99_000_000 }).beforeStep([]);

    expect(decision.kind).toBe("stopped");
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
    expect(budget({}, {}).usageDelivery).toBe("inline");
    expect(budget({}, { capCreditMicros: null }).usageDelivery).toBeUndefined();
  });
});
