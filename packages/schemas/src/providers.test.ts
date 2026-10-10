import { describe, expect, it } from "vitest";

import { agentModelConfig } from "./agent-catalogue.js";
import {
  getPermissionModeUnavailableReason,
  getProviderCapabilities,
  resolveEffectivePermissionMode,
} from "./providers.js";

const BATCH_AGENT_DRIVERS = ["claude-code", "cursor", "grok", "opencode"] as const;

describe("provider contracts", () => {
  it("keeps a conversation's stored permission mode when a request names none", () => {
    expect(resolveEffectivePermissionMode(undefined, "supervised")).toBe("supervised");
    expect(resolveEffectivePermissionMode("full_access", "supervised")).toBe("full_access");
    expect(resolveEffectivePermissionMode(undefined, undefined)).toBe("auto_accept_edits");
    expect(resolveEffectivePermissionMode(undefined, "nonsense")).toBe("auto_accept_edits");
    expect(resolveEffectivePermissionMode(undefined, undefined, ["auto"])).toBe("auto");
    expect(resolveEffectivePermissionMode("full_access", undefined, ["auto"])).toBe("full_access");
  });

  it("offers Supervised only to agents that can answer approvals", () => {
    expect(agentModelConfig["agent/codex"]?.agent?.permissionModes).toEqual([
      "supervised",
      "auto_accept_edits",
      "auto",
      "full_access",
    ]);

    for (const driver of BATCH_AGENT_DRIVERS) {
      const modes = agentModelConfig[`agent/${driver}`]?.agent?.permissionModes ?? [];

      expect(modes).not.toContain("supervised");
      expect(modes.length).toBeGreaterThan(0);
    }
  });

  it("keeps Auto-accept edits available to a batch agent, which needs no approval channel", () => {
    const batch = getProviderCapabilities("claude-code");

    expect(
      getPermissionModeUnavailableReason(batch, "auto_accept_edits", [
        "auto_accept_edits",
        "auto",
        "full_access",
      ]),
    ).toBeUndefined();
    expect(agentModelConfig["agent/claude-code"]?.agent?.permissionModes).toContain(
      "auto_accept_edits",
    );
  });

  it("explains an approval-gated mode a batch agent cannot honour", () => {
    const batch = getProviderCapabilities("claude-code");

    expect(getPermissionModeUnavailableReason(batch, "supervised", ["auto", "full_access"])).toBe(
      "Supervised is unavailable because this provider cannot answer approval requests. Choose a mode that runs without them.",
    );
    expect(
      getPermissionModeUnavailableReason(batch, "full_access", ["auto", "full_access"]),
    ).toBeUndefined();
    expect(
      getPermissionModeUnavailableReason(getProviderCapabilities("codex"), "supervised"),
    ).toBeUndefined();
  });

  it("separates session-capable agents from batch agents", () => {
    expect(getProviderCapabilities("codex")).toMatchObject({
      reportsApprovals: true,
      resumesSessions: true,
      listsModels: true,
    });

    for (const driver of BATCH_AGENT_DRIVERS) {
      expect(getProviderCapabilities(driver)).toMatchObject({
        reportsApprovals: false,
        resumesSessions: false,
        listsModels: false,
        writesFiles: true,
      });
    }
  });
});
