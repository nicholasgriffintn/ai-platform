import { describe, expect, it, vi } from "vitest";

import type { ConnectedDesktopBackend, DesktopDiagnostics } from "./desktop-backend";
import { buildMachineHeartbeatPayload, createMachineHeartbeatScheduler } from "./machine-heartbeat";

const diagnostics: DesktopDiagnostics = {
  appVersion: "0.1.0",
  machineId: "machine-1",
  platform: "macos",
  target: "macos arm64",
  apiBaseUrl: "https://api.polychat.app",
  databasePath: "/tmp/polychat.sqlite",
  endpointCount: 1,
  collectedAt: "2026-09-07T09:00:00.000Z",
};

describe("machine heartbeat", () => {
  it("sends runtime metadata without endpoint addresses or probe details", async () => {
    const backend = {
      listEndpoints: vi.fn().mockResolvedValue([
        {
          id: "ollama-loopback",
          kind: "model",
          vendor: "ollama",
          label: "Ollama",
          url: "http://127.0.0.1:11434",
          transport: "loopback",
          pairingSecretStored: false,
          approvedAt: "2026-09-07T08:00:00.000Z",
          lastSeenAt: null,
        },
      ]),
      probeEndpoint: vi.fn().mockResolvedValue({
        status: "unreachable",
        checkedAt: "2026-09-07T09:00:00.000Z",
        detail: "http://127.0.0.1:11434 refused the connection",
      }),
      discoverModels: vi.fn(),
      probeAgentTool: vi.fn().mockImplementation((vendor: string) =>
        Promise.resolve(
          vendor === "codex"
            ? {
                state: "ready",
                checkedAt: "2026-09-07T09:00:00.000Z",
                version: "1.0.0",
              }
            : { state: "missing", checkedAt: "2026-09-07T09:00:00.000Z" },
        ),
      ),
      agentSupportsSessions: vi
        .fn()
        .mockImplementation((vendor: string) => Promise.resolve(vendor === "codex")),
    } as unknown as ConnectedDesktopBackend;

    const payload = await buildMachineHeartbeatPayload(backend, diagnostics);
    const serialised = JSON.stringify(payload);

    expect(payload).toMatchObject({
      machineId: "machine-1",
      platform: "macos",
      capabilities: ["model-run", "model-relay", "agent-run"],
    });
    expect(payload.runtimes).toContainEqual(
      expect.objectContaining({
        kind: "model",
        vendor: "ollama",
        readiness: expect.objectContaining({ status: "unreachable", detail: null }),
        models: [],
      }),
    );
    expect(payload.runtimes).toContainEqual(
      expect.objectContaining({
        kind: "agent",
        vendor: "codex",
        readiness: expect.objectContaining({ state: "ready" }),
        supportsSessions: true,
      }),
    );
    expect(serialised).not.toContain("127.0.0.1");
    expect(serialised).not.toContain("11434");
  });

  it("runs immediately, avoids overlapping heartbeats and re-runs after a pending trigger", async () => {
    vi.useFakeTimers();
    let resolveHeartbeat: (() => void) | undefined;
    const heartbeat = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveHeartbeat = resolve;
        }),
    );
    const scheduler = createMachineHeartbeatScheduler({ heartbeat, intervalMs: 1000 });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(heartbeat).toHaveBeenCalledTimes(1);

    scheduler.trigger();
    expect(heartbeat).toHaveBeenCalledTimes(1);

    resolveHeartbeat?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(heartbeat).toHaveBeenCalledTimes(2);

    resolveHeartbeat?.();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(heartbeat).toHaveBeenCalledTimes(3);

    scheduler.stop();
    resolveHeartbeat?.();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(heartbeat).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
