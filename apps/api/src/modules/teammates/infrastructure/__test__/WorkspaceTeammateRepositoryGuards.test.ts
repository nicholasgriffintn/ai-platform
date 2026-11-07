import { describe, expect, it, vi } from "vitest";

import { WorkspaceTeammateRepository } from "../WorkspaceTeammateRepository";

function repositoryWith(result: unknown) {
  const first = vi.fn().mockResolvedValue(result);
  const bind = vi.fn().mockReturnValue({ first });
  const prepare = vi.fn().mockReturnValue({ bind });

  return {
    bind,
    prepare,
    repository: new WorkspaceTeammateRepository({ DB: { prepare } } as any),
  };
}

describe("WorkspaceTeammateRepository status guards", () => {
  it("only resumes a teammate that the budget paused", async () => {
    const { repository, prepare, bind } = repositoryWith(null);

    await expect(
      repository.update(
        "workspace",
        "teammate",
        { status: "active", pausedReason: null },
        { status: "paused", pausedReason: "budget" },
      ),
    ).resolves.toBeNull();

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("AND status = ? AND paused_reason = ?"),
    );
    expect(bind.mock.calls[0]?.slice(-2)).toEqual(["paused", "budget"]);
  });

  it("does not delete a hire that was already decided", async () => {
    const { repository, prepare } = repositoryWith(null);

    await expect(repository.deleteProposal("workspace", "teammate")).resolves.toBe(false);

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'proposed'"));
  });
});
