import { describe, expect, it, vi } from "vitest";

import { pushBranchToRemote } from "../../infrastructure/push-branch";

describe("pushBranchToRemote", () => {
  it("pushes without putting credentials on the command line", async () => {
    const exec = vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
    const emitted: Array<Record<string, unknown>> = [];

    await pushBranchToRemote({
      sandbox: {
        exec,
      },
      repoTargetDir: "/workspace/repo",
      branchName: "polychat/feature-456",
      executionLogs: [],
      checkpoint: vi.fn().mockResolvedValue(undefined),
      emit: async (event) => {
        emitted.push(event);
      },
    });

    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec.mock.calls[0]?.[0]).not.toContain("http.extraHeader=");
    expect(exec.mock.calls[0]?.[0]).toContain("push --set-upstream origin 'polychat/feature-456'");
    expect(emitted.map((event) => event.type)).toEqual(["commit_push_started", "commit_pushed"]);
  });
});
