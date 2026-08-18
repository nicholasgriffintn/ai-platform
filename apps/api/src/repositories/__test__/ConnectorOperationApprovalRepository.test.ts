import { describe, expect, it, vi } from "vitest";

import { ConnectorOperationApprovalRepository } from "../ConnectorOperationApprovalRepository";

function createDatabase() {
  const first = vi.fn().mockResolvedValue(null);
  const all = vi.fn().mockResolvedValue({ results: [] });
  const run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } });
  const bind = vi.fn().mockReturnValue({ all, first, run });
  const prepare = vi.fn().mockReturnValue({ bind });

  return { database: { prepare }, prepare, bind, all, run };
}

describe("ConnectorOperationApprovalRepository", () => {
  it("loads a bounded set of user-owned approval states in one query", async () => {
    const { database, prepare, bind } = createDatabase();
    const repository = new ConnectorOperationApprovalRepository({ DB: database } as any);

    await repository.getByIdsForUser(["coa_first", "coa_second", "coa_first"], 42);

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = ? AND id IN (?, ?)"),
    );
    expect(bind).toHaveBeenCalledWith(42, "coa_first", "coa_second");
  });

  it("does not query when there are no approval IDs", async () => {
    const { database, prepare } = createDatabase();
    const repository = new ConnectorOperationApprovalRepository({ DB: database } as any);

    await expect(repository.getByIdsForUser([], 42)).resolves.toEqual([]);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("only resolves a pending, unexpired approval owned by the user", async () => {
    const { database, prepare, bind } = createDatabase();
    const repository = new ConnectorOperationApprovalRepository({ DB: database } as any);

    await repository.resolve({
      id: "coa_approval",
      userId: 42,
      resolution: "approved",
      resolvedAt: "2026-08-13T12:00:00.000Z",
    });

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("state = 'pending' AND expires_at > ?"),
    );
    expect(bind).toHaveBeenCalledWith(
      "approved",
      "2026-08-13T12:00:00.000Z",
      "coa_approval",
      42,
      "2026-08-13T12:00:00.000Z",
    );
  });

  it("atomically consumes an approval only for the exact run and action digest", async () => {
    const { database, prepare, bind } = createDatabase();
    const repository = new ConnectorOperationApprovalRepository({ DB: database } as any);

    await repository.consume({
      id: "coa_approval",
      userId: 42,
      runId: "run_1",
      completionId: "completion_1",
      provider: "gmail",
      operation: "GMAIL_SEND_EMAIL",
      connectedAccountId: "ca_1",
      channel: "web",
      argumentDigest: "abc123",
      consumedAt: "2026-08-13T12:00:00.000Z",
    });

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("AND run_id = ? AND completion_id = ?"),
    );
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining(
        "AND connected_account_id = ? AND channel = ? AND argument_digest = ?",
      ),
    );
    expect(bind).toHaveBeenCalledWith(
      "2026-08-13T12:00:00.000Z",
      "coa_approval",
      42,
      "2026-08-13T12:00:00.000Z",
      "run_1",
      "completion_1",
      "gmail",
      "GMAIL_SEND_EMAIL",
      "ca_1",
      "web",
      "abc123",
    );
  });

  it("expires pending receipts immediately and retains resolved audit state", async () => {
    const { database, prepare, bind } = createDatabase();
    const repository = new ConnectorOperationApprovalRepository({ DB: database } as any);

    await repository.deleteExpired({
      pendingBefore: "2026-08-13T14:00:00.000Z",
      resolvedBefore: "2026-07-14T14:00:00.000Z",
    });

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("state = 'pending' AND expires_at <= ?"),
    );
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("state != 'pending' AND expires_at <= ?"),
    );
    expect(bind).toHaveBeenCalledWith("2026-08-13T14:00:00.000Z", "2026-07-14T14:00:00.000Z");
  });
});
