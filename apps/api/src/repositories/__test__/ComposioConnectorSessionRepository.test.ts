import { describe, expect, it, vi } from "vitest";

import { ComposioConnectorSessionRepository } from "../ComposioConnectorSessionRepository";

function createDatabase(firstResult: unknown = null, allResults: unknown[] = []) {
  const first = vi.fn().mockResolvedValue(firstResult);
  const all = vi.fn().mockResolvedValue({ results: allResults });
  const run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
  const bind = vi.fn().mockReturnValue({ first, all, run });
  const prepare = vi.fn().mockReturnValue({ bind });

  return { database: { prepare }, prepare, bind };
}

describe("ComposioConnectorSessionRepository", () => {
  it("atomically binds a claim to the run, scope, expiry, and operation", async () => {
    const { database, prepare, bind } = createDatabase();
    const repository = new ComposioConnectorSessionRepository({ DB: database } as any);

    const result = await repository.claimForExecution({
      id: "ccs_local",
      userId: 42,
      provider: "gmail",
      operationId: "GMAIL_SEND_EMAIL",
      runId: "run_1",
      completionId: "completion_1",
      recipeId: "daily-digest",
      installationId: "installation_1",
      claimedAt: "2026-08-13T12:00:00.000Z",
    });

    expect(result).toBeNull();
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("AND run_id = ? AND completion_id = ?"),
    );
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("state IN ('active', 'claimed')"));
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("SELECT 1 FROM json_each(allowed_operation_ids) WHERE value = ?"),
    );
    expect(bind).toHaveBeenCalledWith(
      "2026-08-13T12:00:00.000Z",
      "ccs_local",
      42,
      "gmail",
      "2026-08-13T12:00:00.000Z",
      "run_1",
      "completion_1",
      "daily-digest",
      "installation_1",
      "GMAIL_SEND_EMAIL",
    );
  });

  it("lists expired and retryable cleanup records with a bounded limit", async () => {
    const { database, prepare, bind } = createDatabase();
    const repository = new ComposioConnectorSessionRepository({ DB: database } as any);

    await repository.listCleanupDue({
      now: "2026-08-13T12:00:00.000Z",
      limit: 1_000,
    });

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("expires_at <= ?"));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("state = 'cleanup_pending'"));
    expect(bind).toHaveBeenCalledWith("2026-08-13T12:00:00.000Z", "2026-08-13T12:00:00.000Z", 100);
  });
});
