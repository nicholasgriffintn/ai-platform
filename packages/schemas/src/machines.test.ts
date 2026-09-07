import { describe, expect, it } from "vitest";

import { MACHINE_ONLINE_WINDOW_MS, isMachineOnline, machineHeartbeatSchema } from "./machines.js";

const heartbeat = {
  machineId: "machine-1",
  label: "Office desktop",
  platform: "macos" as const,
  appVersion: "0.1.0",
  runtimes: [
    {
      kind: "model" as const,
      vendor: "ollama" as const,
      readiness: {
        status: "ready" as const,
        checkedAt: "2026-09-07T09:00:00.000Z",
        version: "0.12.0",
      },
      models: [
        {
          nativeId: "llama3.2",
          displayName: "Llama 3.2",
          contextTokens: 32_768,
          capabilities: { tools: true, vision: false, thinking: false },
          loaded: true,
        },
      ],
    },
  ],
  capabilities: ["model-run" as const],
};

describe("machine heartbeat contract", () => {
  it("does not accept endpoint addresses in the advertised payload", () => {
    expect(
      machineHeartbeatSchema.safeParse({
        ...heartbeat,
        endpoint: "http://127.0.0.1:11434",
      }).success,
    ).toBe(false);
  });

  it("marks a machine offline at the freshness window", () => {
    const lastSeenAt = "2026-09-07T09:00:00.000Z";
    const now = Date.parse(lastSeenAt) + MACHINE_ONLINE_WINDOW_MS;

    expect(isMachineOnline({ lastSeenAt }, now - 1)).toBe(true);
    expect(isMachineOnline({ lastSeenAt }, now)).toBe(false);
    expect(isMachineOnline({ lastSeenAt: "not-a-date" }, now)).toBe(false);
  });
});
