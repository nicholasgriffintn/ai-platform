import { afterEach, expect, it, vi } from "vitest";

import { waitForInspectionWindow } from "../inspection-window";
import { RunControlClient } from "../run-control-client";

afterEach(() => vi.useRealTimers());

it("limits execution to the inspection deadline and refuses the remaining queued commands", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T00:00:00Z"));
  const fetch = vi
    .fn<Fetcher["fetch"]>()
    .mockResolvedValueOnce(
      Response.json({
        runId: "run",
        state: "inspection",
        updatedAt: "2026-09-08T00:00:00Z",
        inspectionExpiresAt: "2026-09-08T00:00:01Z",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        object: "list",
        has_more: false,
        last_id: "2",
        data: [1, 2].map((index) => ({
          index,
          recordedAt: "2026-09-08T00:00:00Z",
          instruction: {
            id: `command-${index}`,
            runId: "run",
            kind: "run_command",
            command: "pwd",
            createdAt: "2026-09-08T00:00:00Z",
          },
        })),
      }),
    )
    .mockResolvedValue(
      Response.json({
        runId: "run",
        state: "inspection",
        updatedAt: "2026-09-08T00:00:00Z",
        inspectionExpiresAt: "2026-09-08T00:00:01Z",
      }),
    );
  const exec = vi.fn().mockImplementation(async () => {
    vi.setSystemTime(new Date("2026-09-08T00:00:02Z"));

    return { success: true, exitCode: 0, stdout: "", stderr: "", timedOut: false };
  });
  const emit = vi.fn().mockResolvedValue(undefined);
  const pending = waitForInspectionWindow({
    sandbox: { exec },
    repoTargetDir: "/repo",
    controlClient: new RunControlClient({ runId: "run", userToken: "test", apiService: { fetch } }),
    inspectionWindowSeconds: 1,
    trustLevel: "strict",
    environmentVariableNames: [],
    redactionSecrets: [],
    emit,
  });

  await vi.advanceTimersByTimeAsync(600);
  await pending;
  expect(exec).toHaveBeenCalledTimes(1);
  expect(exec.mock.calls[0][1]).toMatchObject({ timeoutMs: 1000 });
  expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: "inspection_window_expired" }));
});
