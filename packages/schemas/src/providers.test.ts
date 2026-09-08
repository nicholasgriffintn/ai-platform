import { describe, expect, it } from "vitest";

import { modelConfigItemSchema } from "./models.js";
import { getProviderCapabilities, providerInstanceSchema } from "./providers.js";

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
