import { describe, expect, it, vi } from "vitest";

import { executeSandboxProvider, type SandboxProvider } from "./index";

const credentialBroker = {
  baseUrl: "https://api.polychat.app/apps/sandbox/credential-broker/run-1",
  expiresAt: "2026-09-12T12:00:00.000Z",
  grant: "scoped-grant",
};

function provider(
  capabilities: SandboxProvider["capabilities"],
  execute = vi.fn(async () => Response.json({ success: true })),
): SandboxProvider {
  return {
    name: "openai",
    capabilities,
    execute,
  };
}

describe("executeSandboxProvider", () => {
  it("removes cache state when an adapter does not support it", async () => {
    const execute = vi.fn(async () => Response.json({ success: true }));
    const adapter = provider(
      {
        credentialBroker: true,
        environmentSetup: true,
        environmentCache: false,
        inspection: false,
        remoteDelivery: true,
        runControls: false,
      },
      execute,
    );

    await executeSandboxProvider(adapter, {
      repo: "owner/repository",
      task: "Implement the feature",
      credentialBroker,
      environmentCache: {
        cacheKey: "a".repeat(64),
        backupId: "backup-1",
        restoreDirectory: "/workspace/repository",
        generation: 1,
        createdAt: "2026-09-12T11:00:00.000Z",
        repositoryRevision: "0123456789abcdef",
        configurationRevision: "abcdef0123456789",
        platformVersion: "environment-v1",
        status: "ready",
      },
      environmentCacheGeneration: 1,
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentCache: undefined,
        environmentCacheGeneration: undefined,
      }),
    );
  });

  it("rejects unsupported provider features before execution", async () => {
    const execute = vi.fn(async () => Response.json({ success: true }));
    const adapter = provider(
      {
        credentialBroker: true,
        environmentSetup: true,
        environmentCache: false,
        inspection: false,
        remoteDelivery: true,
        runControls: false,
      },
      execute,
    );

    expect(() =>
      executeSandboxProvider(adapter, {
        repo: "owner/repository",
        task: "Implement the feature",
        credentialBroker,
        inspectionWindowSeconds: 30,
      }),
    ).toThrow("does not support post-run inspection");
    expect(execute).not.toHaveBeenCalled();
  });
});
