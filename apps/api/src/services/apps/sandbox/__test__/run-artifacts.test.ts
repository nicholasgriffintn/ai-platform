import { beforeEach, describe, expect, it, vi } from "vitest";

import { StorageService } from "~/lib/storage";

import { persistSandboxRunArtifact } from "../run-artifacts";

const mockStoreOutputFile = vi.fn();

vi.mock("~/lib/storage", () => ({
  StorageService: {
    forPrivateAssets: vi.fn(() => ({
      storeOutputFile: mockStoreOutputFile,
    })),
  },
}));

describe("sandbox run artifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreOutputFile.mockImplementation(async ({ key }) => ({
      outputId: `output:${key}`,
      key,
      url: `/outputs/${encodeURIComponent(key)}`,
    }));
  });

  it("replaces terminal event logs and diffs with artifact references after offload", async () => {
    const logs = "log line\n".repeat(20_000);
    const diff = `diff --git a/Main.lean b/Main.lean\n${"+theorem proof := by simp\n".repeat(20_000)}`;
    const result = {
      success: true,
      summary: "Proof checked",
      logs,
      diff,
    };

    const persisted = await persistSandboxRunArtifact({
      serviceContext: {
        env: { PRIVATE_ASSETS_BUCKET: {} },
      } as any,
      ownerUserId: 42,
      run: {
        runId: "run-123",
        installationId: 99,
        repo: "owner/repo",
        task: "Check proof",
        model: "labs-leanstral-1-5",
        shouldCommit: false,
        status: "completed",
        startedAt: "2026-03-15T12:00:00.000Z",
        updatedAt: "2026-03-15T12:01:00.000Z",
        completedAt: "2026-03-15T12:01:00.000Z",
        result,
        events: [
          {
            type: "run_completed",
            runId: "run-123",
            result,
            timestamp: "2026-03-15T12:01:00.000Z",
          },
        ],
      },
    });

    const terminalResult = persisted.events?.[0]?.result;

    expect(persisted.result?.logs).toBeUndefined();
    expect(persisted.result?.diff).toBeUndefined();
    expect(terminalResult?.logs).toBeUndefined();
    expect(terminalResult?.diff).toBeUndefined();
    expect(terminalResult).toEqual(
      expect.objectContaining({
        summary: "Proof checked",
        artifactManifestKey: "sandbox/runs/run-123/manifest.json",
        logsArtifactKey: "sandbox/runs/run-123/logs.txt",
      }),
    );
    expect(JSON.stringify(persisted)).not.toContain(diff);
    expect(JSON.stringify(persisted)).not.toContain(logs);

    const eventsWrite = mockStoreOutputFile.mock.calls.find(
      ([request]) => request.key === "sandbox/runs/run-123/events.ndjson",
    )?.[0];
    const archivedTerminalEvent = JSON.parse(eventsWrite?.data ?? "{}");

    expect(archivedTerminalEvent.result.diff).toBe(diff);
    expect(archivedTerminalEvent.result.logs).toBe(logs);
    expect(StorageService.forPrivateAssets).toHaveBeenCalled();
  });
});
