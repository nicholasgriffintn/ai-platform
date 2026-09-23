import { describe, expect, it } from "vitest";

import {
  discoverAssistantCapabilities,
  type CapabilityDiscoverySources,
} from "~/modules/assistant-capabilities/application/discovery";

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
      await import("~/modules/assistant-capabilities/application/discovery");
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

describe("discoverAssistantCapabilities with semantic relevance", () => {
  const tools = [
    {
      id: "create_qr_code",
      name: "Create QR code",
      description: "Create a QR code from text.",
      type: "normal" as const,
      activation: { allowed: true },
    },
    {
      id: "web_search",
      name: "Web search",
      description: "Search the web for current information.",
      type: "normal" as const,
      activation: { allowed: true },
    },
  ];

  it("surfaces a capability with no keyword overlap when the decision model rates it relevant", () => {
    const result = discoverAssistantCapabilities(
      sources({ tools }),
      { query: "make something my phone can scan", limit: 8 },
      new Date(),
      new Map([["tool:create_qr_code", 0.92]]),
    );

    expect(result.items.map((item) => item.id)).toEqual(["tool:create_qr_code"]);
  });

  it("lets a confident semantic match outrank a weak keyword match", () => {
    const result = discoverAssistantCapabilities(
      sources({ tools }),
      { query: "search for a code", limit: 8 },
      new Date(),
      new Map([["tool:create_qr_code", 0.9]]),
    );

    expect(result.items.map((item) => item.id)).toEqual(["tool:create_qr_code", "tool:web_search"]);
  });
});
