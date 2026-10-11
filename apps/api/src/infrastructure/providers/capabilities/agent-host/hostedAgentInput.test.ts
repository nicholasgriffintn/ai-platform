import { describe, expect, it } from "vitest";

import {
  buildHostedAgentInstructions,
  truncateAgentInput,
  resolveAgentNetworkHosts,
} from "./hostedAgentInput";

describe("buildHostedAgentInstructions", () => {
  it("returns undefined without a system prompt", () => {
    expect(buildHostedAgentInstructions(undefined)).toBeUndefined();
    expect(buildHostedAgentInstructions("  ")).toBeUndefined();
  });

  it("passes the system prompt through and caps its length", () => {
    expect(buildHostedAgentInstructions("Be helpful")).toBe("Be helpful");
    expect(buildHostedAgentInstructions(`x`.repeat(20_000))?.length).toBeLessThanOrEqual(12_000);
  });
});

describe("truncateAgentInput", () => {
  it("trims the current message and caps it at the wire limit", () => {
    expect(truncateAgentInput("  Hello  ")).toBe("Hello");
    expect(truncateAgentInput(`x`.repeat(200_000)).length).toBeLessThanOrEqual(100_000);
  });
});

describe("resolveAgentNetworkHosts", () => {
  it("reads declared hosts from sandbox environment setup", () => {
    expect(
      resolveAgentNetworkHosts({
        sandbox: {
          environmentSetup: {
            source: "polychat",
            definition: { networkHosts: ["api.example.com"] },
          },
        },
      }),
    ).toEqual(["api.example.com"]);
  });

  it("returns no hosts for repository setups or missing options", () => {
    expect(resolveAgentNetworkHosts(undefined)).toEqual([]);
    expect(
      resolveAgentNetworkHosts({ sandbox: { environmentSetup: { source: "repository" } } }),
    ).toEqual([]);
  });
});
