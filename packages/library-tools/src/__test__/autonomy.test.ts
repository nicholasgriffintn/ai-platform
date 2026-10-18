import {
  activeToolRules,
  type TeammateAutonomyLevel,
  type ToolEffectClass,
} from "@ngriffin_uk/polychat-schemas";
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

  it("lets an act rule lift the assistant's ask for writes but never the floor", () => {
    expect(withRule("write", "act")).toMatchObject({ allowed: true, requiresApproval: false });
    expect(withRule("external_send", "act")).toMatchObject({ requiresApproval: true });
    expect(withRule("write", "act", true, "observer")).toMatchObject({ allowed: false });
  });

  it("acts on request only on turns the owner started", () => {
    expect(withRule("write", "act_if_asked", true)).toMatchObject({ requiresApproval: false });
    expect(withRule("write", "act_if_asked", false)).toMatchObject({
      requiresApproval: true,
      reason:
        'Your rules let "call_api" run only when you asked for it, so it needs your approval here',
    });
  });

  it("asks for reads when told to and refuses tools handed back", () => {
    expect(withRule("read", "ask", true, "partner")).toMatchObject({
      allowed: true,
      requiresApproval: true,
    });
    expect(withRule("read", "hand_off", true, "partner")).toMatchObject({
      allowed: false,
      reason: 'Tool "call_api" is handed to you by your rules, so do this step yourself',
    });
  });
});

describe("account rules outside a teammate", () => {
  function inPlainChat(effectClass: ToolEffectClass, toolRule?: "act" | "ask") {
    return checker.checkRequestToolAccess({
      toolName: "call_api",
      mode: "agent",
      user: { id: 1, plan_id: "pro" },
      toolPermissions: ["network", "write"],
      effectClass,
      toolRule,
      requireApprovalFor: [],
    });
  }

  it("lets an act rule lift a mode's own ask but never the floor", () => {
    expect(inPlainChat("write").requiresApproval).toBe(true);
    expect(inPlainChat("write", "act").requiresApproval).toBe(false);
    expect(inPlainChat("external_send", "act")).toMatchObject({
      requiresApproval: true,
      reason: 'Tool "call_api" sends to people outside Polychat, which always needs your approval',
    });
  });

  it("never lifts approvals a workspace requires", () => {
    const result = checker.checkRequestToolAccess({
      toolName: "call_api",
      mode: "chat",
      user: { id: 1, plan_id: "pro" },
      toolPermissions: ["network", "write"],
      effectClass: "write",
      toolRule: "act",
      requireApprovalFor: ["write"],
    });

    expect(result.requiresApproval).toBe(true);
  });
});

describe("suspended acting rules", () => {
  it("keeps asking and handing back but drops rules that would act on their own", () => {
    const rules = [
      { toolName: "create_note", level: "act" as const },
      { toolName: "calendar", level: "act_if_asked" as const },
      { toolName: "web_search", level: "ask" as const },
      { toolName: "send_email", level: "hand_off" as const },
    ];

    expect(activeToolRules(rules, true).map((rule) => rule.level)).toEqual(["ask", "hand_off"]);
    expect(activeToolRules(rules, false)).toHaveLength(4);
  });
});
