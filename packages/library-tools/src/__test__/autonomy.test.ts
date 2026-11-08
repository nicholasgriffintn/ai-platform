import type { TeammateAutonomyLevel, ToolEffectClass } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { PermissionChecker } from "../permissions.js";

const checker = new PermissionChecker();

function check(effectClass: ToolEffectClass, autonomyLevel?: TeammateAutonomyLevel | null) {
  return checker.checkRequestToolAccess({
    toolName: "call_api",
    mode: "chat",
    user: { id: 1, plan_id: "pro" },
    toolPermissions: ["network", "write"],
    effectClass,
    autonomyLevel,
  });
}

describe("teammate autonomy", () => {
  it("lets an observer read and draft but never change anything", () => {
    expect(check("read", "observer")).toMatchObject({ allowed: true, requiresApproval: false });
    expect(check("draft", "observer")).toMatchObject({ allowed: true, requiresApproval: false });
    expect(check("write", "observer")).toMatchObject({
      allowed: false,
      reason:
        'Tool "call_api" would change something (write), and this teammate is set to observe only',
    });
  });

  it.each(["spend", "destructive"] as const)(
    "always asks before %s, even for a partner",
    (effectClass) => {
      const result = check(effectClass, "partner");

      expect(result).toMatchObject({ allowed: true, requiresApproval: true });
      expect(result.reason).toContain("which always needs your approval");
    },
  );
});

describe("per-tool rules", () => {
  function withRule(
    effectClass: ToolEffectClass,
    toolRule: "act" | "act_if_asked" | "ask" | "hand_off",
    ownerStartedRun = true,
    autonomyLevel: TeammateAutonomyLevel = "assistant",
  ) {
    return checker.checkRequestToolAccess({
      toolName: "call_api",
      mode: "chat",
      user: { id: 1, plan_id: "pro" },
      toolPermissions: ["network", "write"],
      effectClass,
      autonomyLevel,
      toolRule,
      ownerStartedRun,
    });
  }

  it("acts on request only on turns the owner started", () => {
    expect(withRule("write", "act_if_asked", true)).toMatchObject({ requiresApproval: false });
    expect(withRule("write", "act_if_asked", false)).toMatchObject({
      requiresApproval: true,
      reason:
        'Your rules let "call_api" run only when you asked for it, so it needs your approval here',
    });
  });
});
