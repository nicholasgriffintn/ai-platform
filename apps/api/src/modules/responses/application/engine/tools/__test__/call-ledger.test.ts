import { describe, expect, it } from "vitest";

import { checkToolCallTurnBudget, createToolCallLedger } from "../call-ledger";

describe("checkToolCallTurnBudget", () => {
  it("refuses a capped tool once its claimed calls reach the limit", () => {
    const ledger = createToolCallLedger();

    for (let call = 0; call < 3; call += 1) {
      const budget = checkToolCallTurnBudget(ledger, "preview_html", 3);

      expect(budget.allowed).toBe(true);
      budget.claim();
    }

    expect(checkToolCallTurnBudget(ledger, "preview_html", 3).allowed).toBe(false);
    expect(checkToolCallTurnBudget(ledger, "web_search", 3).allowed).toBe(true);
  });

  it("only spends the allowance for calls that were claimed", () => {
    const ledger = createToolCallLedger();

    checkToolCallTurnBudget(ledger, "preview_html", 1);

    expect(checkToolCallTurnBudget(ledger, "preview_html", 1).allowed).toBe(true);
  });

  it("never refuses a tool without a cap", () => {
    const ledger = createToolCallLedger();

    for (let call = 0; call < 50; call += 1) {
      checkToolCallTurnBudget(ledger, "web_search", undefined).claim();
    }

    expect(checkToolCallTurnBudget(ledger, "web_search", undefined).allowed).toBe(true);
  });
});
