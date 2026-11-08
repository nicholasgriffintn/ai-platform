import { describe, expect, it } from "vitest";

import { PermissionChecker } from "../permissions.js";

describe("PermissionChecker", () => {
  const checker = new PermissionChecker();

  it("gates premium and BYOK tools by plan and sign-in", () => {
    expect(
      checker.checkToolAccess({
        toolName: "create_note",
        toolType: "premium",
        user: { id: 1, plan_id: "free" },
      }),
    ).toMatchObject({ allowed: false, reason: "This tool requires a premium subscription" });

    expect(
      checker.checkToolAccess({
        toolName: "create_note",
        toolType: "premium",
        user: { id: 1, plan_id: "pro" },
      }),
    ).toMatchObject({ allowed: true });

    expect(
      checker.checkToolAccess({
        toolName: "research",
        toolType: "byok",
        user: { id: 1, plan_id: "free" },
      }),
    ).toMatchObject({ allowed: true });

    expect(checker.checkToolAccess({ toolName: "research", toolType: "byok" })).toMatchObject({
      allowed: false,
      reason: "This tool requires a signed-in user",
    });
  });

  it("blocks a tool whose permission the mode denies", () => {
    for (const [mode, toolName, permission] of [
      ["plan", "run_command", "sandbox"],
      ["plan", "call_api", "network"],
      ["explore", "create_note", "write"],
    ]) {
      expect(
        checker.checkToolAccess({ toolName, mode, toolPermissions: [permission] }),
      ).toMatchObject({ allowed: false, mode });
    }
  });

  it("reports whether a tool was pre-approved", () => {
    expect(
      checker.checkRequestToolAccess({
        toolName: "run_command",
        mode: "build",
        toolPermissions: ["sandbox"],
        approvedTools: [" RUN_COMMAND "],
      }),
    ).toMatchObject({ approved: true });

    expect(
      checker.checkRequestToolAccess({
        toolName: "run_command",
        mode: "build",
        toolPermissions: ["sandbox"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: true, approved: false });
  });
});
