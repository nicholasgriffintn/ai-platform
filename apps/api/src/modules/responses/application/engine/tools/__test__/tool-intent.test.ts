import { describe, expect, it, vi } from "vitest";

vi.mock("~/infrastructure/ai", () => ({ ai: { evaluateDecisionPolicy: vi.fn() } }));

import {
  describeRunStarter,
  requiresToolIntentVerification,
  TOOL_INTENT_POLICY,
} from "../tool-intent";

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
  it("verifies sends, spends and deletes whatever their permissions say", () => {
    expect(
      requiresToolIntentVerification({
        permissions: ["network"],
        alreadyApproved: false,
        effectClass: "external_send",
      }),
    ).toBe(true);
    expect(
      requiresToolIntentVerification({
        permissions: ["read"],
        alreadyApproved: false,
        effectClass: "spend",
      }),
    ).toBe(true);
  });

  it("still verifies write-permission tools and skips reads", () => {
    expect(
      requiresToolIntentVerification({
        permissions: ["write"],
        alreadyApproved: false,
        effectClass: "write",
      }),
    ).toBe(true);
    expect(
      requiresToolIntentVerification({
        permissions: ["read", "network"],
        alreadyApproved: false,
        effectClass: "read",
      }),
    ).toBe(false);
  });

  it("skips a call the person approved themselves", () => {
    expect(
      requiresToolIntentVerification({
        permissions: ["write"],
        alreadyApproved: true,
        effectClass: "external_send",
      }),
    ).toBe(false);
  });
});

describe("TOOL_INTENT_POLICY", () => {
  it("allows a call that matches the request and stays in scope", () => {
    expect(TOOL_INTENT_POLICY.evaluate(answers({})).outcome).toBe("allow");
  });

  it("asks when the destination was never named", () => {
    const result = TOOL_INTENT_POLICY.evaluate(answers({ destination_in_scope: 0.1 }));

    expect(result.outcome).toBe("require_approval");
    expect(result.reason).toContain("destination");
  });

  it("asks when the judge is unsure", () => {
    expect(TOOL_INTENT_POLICY.evaluate(answers({ matches_request: 0.55 })).outcome).toBe(
      "require_approval",
    );
  });
});

describe("describeRunStarter", () => {
  it("names the person for owner turns and an unattended starter otherwise", () => {
    expect(describeRunStarter(undefined)).toContain("the person");
    expect(describeRunStarter("schedule")).toContain("nobody watching");
    expect(describeRunStarter("channel")).toContain("untrusted");
  });
});
