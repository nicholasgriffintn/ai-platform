import { describe, expect, it } from "vitest";

import {
  discoverAssistantCapabilities,
  type CapabilityDiscoverySources,
} from "../assistant-capability-discovery";

function sources(overrides: Partial<CapabilityDiscoverySources> = {}): CapabilityDiscoverySources {
  return {
    activatableToolIds: new Set(["trigger_recipe", "use_recipe_connector"]),
    connectors: [],
    enabledToolIds: new Set(),
    installations: [],
    isPro: true,
    isSignedIn: true,
    recipes: [],
    tools: [],
    ...overrides,
  };
}

describe("discoverAssistantCapabilities", () => {
  it("makes an eligible disabled native tool ready for response-scoped activation", () => {
    const result = discoverAssistantCapabilities(
      sources({
        tools: [
          {
            id: "create_qr_code",
            name: "Create QR code",
            description: "Create a QR code from text.",
            type: "normal",
            activation: { allowed: true },
          },
        ],
      }),
      { query: "create a QR code", limit: 8 },
    );

    expect(result.items).toEqual([
      expect.objectContaining({
        id: "tool:create_qr_code",
        state: "ready",
        reason: "This tool will be enabled automatically for this response.",
        invocation: expect.objectContaining({
          toolName: "create_qr_code",
          availableNow: true,
          autoActivate: true,
        }),
      }),
    ]);
    expect(result.readiness).toMatchObject({ state: "ready", reasonCode: "ready" });
  });

  it("returns a fresh unknown result when discovery sources cannot be checked", async () => {
    const { createUnknownCapabilityDiscoveryResult } =
      await import("../assistant-capability-discovery");
    const result = createUnknownCapabilityDiscoveryResult(
      "send mail",
      new Date("2026-09-05T10:00:00.000Z"),
    );

    expect(result).toMatchObject({
      query: "send mail",
      items: [],
      readiness: {
        state: "unknown",
        reasonCode: "check_failed",
        checkedAt: "2026-09-05T10:00:00.000Z",
        expiresAt: "2026-09-05T10:01:00.000Z",
        action: { kind: "retry" },
      },
    });
  });

  it("does not activate a native tool blocked by the current policy", () => {
    const result = discoverAssistantCapabilities(
      sources({
        tools: [
          {
            id: "create_note",
            name: "Create note",
            description: "Create a saved note.",
            type: "normal",
            activation: {
              allowed: false,
              reason: 'Tool "create_note" is not allowed in plan mode',
            },
          },
        ],
      }),
      { query: "create a note", limit: 8 },
    );

    expect(result.items[0]).toMatchObject({
      state: "unavailable",
      reason: 'Tool "create_note" is not allowed in plan mode',
      invocation: { availableNow: false },
    });
    expect(result.items[0]?.invocation.autoActivate).toBeUndefined();
  });

  it("activates the connector runner for a connected connector", () => {
    const result = discoverAssistantCapabilities(
      sources({
        connectors: [
          {
            id: "gmail",
            name: "Gmail",
            description: "Read and send Gmail messages.",
            categories: [],
            authType: "composio",
            status: "connected",
            scopes: [],
            toolCount: 4,
            readToolCount: 3,
            writeToolCount: 1,
          },
        ],
      }),
      { query: "gmail", limit: 8 },
    );

    expect(result.items[0]).toMatchObject({
      state: "ready",
      invocation: { toolName: "use_recipe_connector", availableNow: true, autoActivate: true },
    });
  });

  it("leaves an already enabled connector runner alone", () => {
    const result = discoverAssistantCapabilities(
      sources({
        connectors: [
          {
            id: "gmail",
            name: "Gmail",
            description: "Read and send Gmail messages.",
            categories: [],
            authType: "composio",
            status: "connected",
            scopes: [],
            toolCount: 4,
            readToolCount: 3,
            writeToolCount: 1,
          },
        ],
        enabledToolIds: new Set(["use_recipe_connector"]),
      }),
      { query: "gmail", limit: 8 },
    );

    expect(result.items[0]?.invocation.autoActivate).toBeUndefined();
  });
});
