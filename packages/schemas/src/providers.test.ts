import { describe, expect, it } from "vitest";

import { agentModelConfig } from "./agent-catalogue.js";
import { modelConfigItemSchema } from "./models.js";
import {
  getPermissionModeUnavailableReason,
  getProviderCapabilities,
  providerInstanceSchema,
  resolveEffectivePermissionMode,
} from "./providers.js";

const BATCH_AGENT_DRIVERS = ["claude-code", "cursor", "grok", "opencode"] as const;

describe("provider contracts", () => {
  it("leaves catalogue entries unmarked and round-trips agent entries", () => {
    expect(
      modelConfigItemSchema.parse({ matchingModel: "claude-sonnet", provider: "anthropic" }),
    ).not.toHaveProperty("kind");

    const agent = modelConfigItemSchema.parse({
      kind: "agent",
      matchingModel: "codex",
      provider: "codex",
      agent: {
        capabilities: getProviderCapabilities("codex"),
        workspace: { kind: "repository" },
        permissionModes: ["supervised", "auto"],
      },
    });

    expect(agent.kind).toBe("agent");
    expect(agent.agent?.workspace).toEqual({ kind: "repository" });
  });

  it("keeps a conversation's stored permission mode when a request names none", () => {
    expect(resolveEffectivePermissionMode(undefined, "supervised")).toBe("supervised");
    expect(resolveEffectivePermissionMode("full_access", "supervised")).toBe("full_access");
    expect(resolveEffectivePermissionMode(undefined, undefined)).toBe("auto_accept_edits");
    expect(resolveEffectivePermissionMode(undefined, "nonsense")).toBe("auto_accept_edits");
  });

  it("declares provider-specific capability differences", () => {
    expect(getProviderCapabilities("antigravity")).toMatchObject({
      streamsText: false,
      reportsApprovals: false,
      checkpoints: true,
      rollsBack: false,
    });
    expect(getProviderCapabilities("ollama").listsModels).toBe(true);
    expect(getProviderCapabilities("codex").picksOwnModel).toBe(true);
  });

  it("offers approval-gated permission modes only to agents that can answer approvals", () => {
    expect(agentModelConfig["agent/codex"]?.agent?.permissionModes).toEqual([
      "supervised",
      "auto_accept_edits",
      "auto",
      "full_access",
    ]);

    for (const driver of BATCH_AGENT_DRIVERS) {
      const modes = agentModelConfig[`agent/${driver}`]?.agent?.permissionModes ?? [];

      expect(modes).not.toContain("supervised");
      expect(modes).not.toContain("auto_accept_edits");
      expect(modes.length).toBeGreaterThan(0);
    }
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

  it("keeps instance identity independent from its driver", () => {
    const first = providerInstanceSchema.parse({
      id: "ollama-personal",
      driver: "ollama",
      label: "Personal Ollama",
      accountId: null,
      capabilities: getProviderCapabilities("ollama"),
      createdAt: "2026-09-08T00:00:00.000Z",
      lastUsedAt: null,
    });
    const second = { ...first, id: "ollama-work" };

    expect(first.id).not.toBe(second.id);
    expect(first.driver).toBe(second.driver);
  });
});
