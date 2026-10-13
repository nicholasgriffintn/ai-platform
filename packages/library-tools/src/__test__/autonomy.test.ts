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
  it("leaves runs without a level to the existing approval rules", () => {
    expect(check("write")).toMatchObject({ allowed: true, requiresApproval: false });
    expect(check("spend", null)).toMatchObject({ allowed: true, requiresApproval: false });
  });

  it("lets an observer read and draft but never change anything", () => {
    expect(check("read", "observer")).toMatchObject({ allowed: true, requiresApproval: false });
    expect(check("draft", "observer")).toMatchObject({ allowed: true, requiresApproval: false });
    expect(check("write", "observer")).toMatchObject({
      allowed: false,
      reason:
        'Tool "call_api" would change something (write), and this teammate is set to observe only',
    });
  });

  it("asks before an assistant writes and lets a partner write within its grants", () => {
    expect(check("write", "assistant")).toMatchObject({
      allowed: true,
      requiresApproval: true,
      reason:
        'Tool "call_api" writes outside this conversation, so it needs your approval at the assistant level',
    });
    expect(check("write", "partner")).toMatchObject({ allowed: true, requiresApproval: false });
  });

  it.each(["external_send", "spend", "destructive", "credential", "data_export"] as const)(
    "always asks before %s, even for a partner",
    (effectClass) => {
      const result = check(effectClass, "partner");

      expect(result).toMatchObject({ allowed: true, requiresApproval: true });
      expect(result.reason).toContain("which always needs your approval");
    },
  );

  it("lets a standing approval lift the assistant's ask for writes but never the floor", () => {
    const withStanding = (effectClass: ToolEffectClass) =>
      checker.checkRequestToolAccess({
        toolName: "call_api",
        mode: "chat",
        user: { id: 1, plan_id: "pro" },
        toolPermissions: ["network", "write"],
        effectClass,
        autonomyLevel: "assistant",
        standingApproval: true,
      });

    expect(withStanding("write")).toMatchObject({ allowed: true, requiresApproval: false });
    expect(withStanding("destructive")).toMatchObject({ allowed: true, requiresApproval: true });
  });

  it("still honours an approval the person gave for this call", () => {
    const result = checker.checkRequestToolAccess({
      toolName: "call_api",
      mode: "chat",
      user: { id: 1, plan_id: "pro" },
      toolPermissions: ["network", "write"],
      effectClass: "destructive",
      autonomyLevel: "partner",
      approvedTools: ["call_api"],
    });

    expect(result).toMatchObject({ requiresApproval: true, approved: true });
  });
});
