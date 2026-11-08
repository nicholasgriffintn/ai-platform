import { describe, expect, it, vi } from "vitest";

vi.mock("~/infrastructure/ai", () => ({ ai: { evaluateDecisionPolicy: vi.fn() } }));

import { requiresToolIntentVerification, TOOL_INTENT_POLICY } from "../tool-intent";

function answers(overrides: Partial<Record<keyof typeof TOOL_INTENT_POLICY.questions, number>>) {
  const values = {
    matches_request: 0.95,
    expands_scope: 0.05,
    destination_in_scope: 0.95,
    needs_clarification: 0.05,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, noul]) => [key, { type: "noul" as const, noul }]),
  ) as Parameters<typeof TOOL_INTENT_POLICY.evaluate>[0];
}

describe("requiresToolIntentVerification", () => {
  it("verifies writes, sends, spends and deletes", () => {
    for (const effectClass of ["write", "external_send", "spend", "destructive"] as const) {
      expect(requiresToolIntentVerification({ alreadyApproved: false, effectClass })).toBe(true);
    }
  });

  it("verifies a read the integration only claims, until the person approves it", () => {
    expect(
      requiresToolIntentVerification({
        alreadyApproved: false,
        effectClass: "read",
        effectClaimed: true,
      }),
    ).toBe(true);
    expect(
      requiresToolIntentVerification({
        alreadyApproved: true,
        effectClass: "read",
        effectClaimed: true,
      }),
    ).toBe(false);
  });
});

describe("TOOL_INTENT_POLICY", () => {
  it("asks when the destination was never named", () => {
    const result = TOOL_INTENT_POLICY.evaluate(answers({ destination_in_scope: 0.1 }));

    expect(result.outcome).toBe("require_approval");
    expect(result.reason).toContain("destination");
  });
});
