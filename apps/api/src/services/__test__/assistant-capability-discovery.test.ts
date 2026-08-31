import { describe, expect, it } from "vitest";

import {
  discoverAssistantCapabilities,
  type CapabilityDiscoverySources,
} from "../assistant-capability-discovery";

function sources(overrides: Partial<CapabilityDiscoverySources> = {}): CapabilityDiscoverySources {
  return {
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
});
