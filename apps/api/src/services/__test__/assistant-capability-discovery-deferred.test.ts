import { describe, expect, it } from "vitest";

import {
  discoverAssistantCapabilities,
  type CapabilityDiscoverySources,
} from "../assistant-capability-discovery";

const imageTool = {
  id: "create_image",
  name: "Create image",
  description: "Generate an image from a prompt.",
  type: "normal" as const,
};

function createSources(overrides: Partial<CapabilityDiscoverySources>): CapabilityDiscoverySources {
  return {
    connectors: [],
    deferredToolIds: new Set<string>(),
    enabledToolIds: new Set<string>(),
    installations: [],
    isPro: false,
    isSignedIn: true,
    recipes: [],
    tools: [imageTool],
    ...overrides,
  };
}

function discoverImage(sources: CapabilityDiscoverySources) {
  return discoverAssistantCapabilities(sources, { query: "image", limit: 5 }).items[0];
}

describe("capability discovery over deferred tools", () => {
  it("reports a withheld tool as ready and tells the model when it can call it", () => {
    const item = discoverImage(createSources({ deferredToolIds: new Set(["create_image"]) }));

    expect(item.state).toBe("ready");
    expect(item.invocation.availableNow).toBe(true);
    expect(item.invocation.instruction).toContain("next turn");
  });

  it("still refuses a tool that was never enabled and is not deferred", () => {
    const item = discoverImage(createSources({}));

    expect(item.state).toBe("unavailable");
    expect(item.invocation.availableNow).toBe(false);
    expect(item.invocation.instruction).toContain("Ask the user to enable");
  });

  it("keeps plan gating ahead of deferral", () => {
    const item = discoverImage(
      createSources({
        tools: [{ ...imageTool, type: "premium" }],
        deferredToolIds: new Set(["create_image"]),
        isPro: false,
      }),
    );

    expect(item.state).toBe("unavailable");
    expect(item.reason).toContain("Pro plan");
  });

  it("leaves an inline enabled tool's wording unchanged", () => {
    const item = discoverImage(createSources({ enabledToolIds: new Set(["create_image"]) }));

    expect(item.invocation.instruction).toBe(
      "Call create_image using its declared parameter schema.",
    );
  });
});
