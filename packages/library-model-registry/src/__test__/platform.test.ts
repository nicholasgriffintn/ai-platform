import type { ModelBudget } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { preflightSpend, redactPii } from "../index.js";

describe("dataset canonicalisation", () => {
  it("redacts email addresses and valid card numbers but leaves short numbers", () => {
    expect(redactPii("Write to jo@example.com, card 4111 1111 1111 1111, order 42")).toBe(
      "Write to [EMAIL], card [CARD], order 42",
    );
  });
});

describe("spend preflight", () => {
  const budget: ModelBudget = {
    id: "b",
    workspaceId: "w",
    projectId: null,
    monthlyLimitUsd: 1000,
    softLimitPercent: 80,
    hardStop: true,
    approvalAboveUsd: 200,
    idlePauseMinutes: null,
    updatedAt: "2026-09-01T00:00:00Z",
    updatedBy: 1,
  };

  it("blocks spend past a hard limit, asks above the approval threshold and warns near the soft limit", () => {
    expect(preflightSpend([{ budget, spentUsd: 900, committedUsd: 50 }], 100).decision).toBe(
      "blocked",
    );
    expect(preflightSpend([{ budget, spentUsd: 0, committedUsd: 0 }], 250).decision).toBe(
      "needs_approval",
    );
    expect(preflightSpend([{ budget, spentUsd: 700, committedUsd: 0 }], 150).decision).toBe("warn");
    expect(preflightSpend([{ budget, spentUsd: 0, committedUsd: 0 }], 50).decision).toBe("allow");
  });

  it("preserves fractional approval thresholds and denies invalid budget facts", () => {
    const lines = [{ budget, spentUsd: 0, committedUsd: 0 }];

    expect(preflightSpend(lines, 200).decision).toBe("allow");
    expect(preflightSpend(lines, 200.0001).decision).toBe("needs_approval");
    expect(preflightSpend(lines, Number.NaN).decision).toBe("blocked");
    expect(preflightSpend([{ ...lines[0], spentUsd: Number.POSITIVE_INFINITY }], 1).decision).toBe(
      "blocked",
    );
  });
});
